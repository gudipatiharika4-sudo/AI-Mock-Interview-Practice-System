const express = require('express');
const { randomUUID } = require('node:crypto');
const supabase = require('../supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const levels = ['beginner', 'intermediate', 'advanced'];
const focuses = ['behavioral', 'technical', 'mixed'];
const banks = {
  behavioral: ['Tell me about yourself and the experiences that prepare you for this role.', 'Why are you interested in this role, and what would you like to learn?', 'Describe a time you worked with a team to reach a goal.', 'Tell me about a challenge you faced and how you handled it.', 'Describe a time you received feedback. What did you do next?', 'Tell me about a mistake you made and what you learned.', 'How do you organize your work when you have several deadlines?', 'Describe a time you had to learn something quickly.', 'What achievement are you most proud of, and why?', 'Tell me about a disagreement in a team and how you approached it.', 'What are your strengths, and how have you used them?', 'What skill are you currently working to improve?'],
  technical: ['Explain a technical project you have worked on and the problem it solves.', 'How would you explain a variable and a function to a beginner?', 'What is the difference between an array and an object?', 'How would you find and fix a bug in a program?', 'What is an HTTP request, and what happens after a browser sends one?', 'How would you design a simple API endpoint for creating a record?', 'What is a database primary key, and why is it useful?', 'How do you check that user input is valid and safe?', 'Describe a programming concept you learned recently.', 'How would you make a web page work well on a phone?', 'What is the difference between frontend and backend code?', 'How would you test a feature before sharing it?'],
  mixed: ['Tell me about a project you are proud of. What was your contribution?', 'What interests you about this role and this team?', 'Explain a technical problem you solved in simple terms.', 'Describe how you handle a task when the requirements are unclear.', 'How would you respond if a teammate disagreed with your approach?', 'What is one technical skill you want to strengthen?', 'Walk me through how you debug a feature that stopped working.', 'Tell me about a time you learned from constructive feedback.', 'How would you prioritize two tasks due at the same time?', 'What makes code easy for another person to understand?', 'Describe a project setback and how you adapted.', 'What questions would you ask an interviewer about this role?']
};function pickQuestions(focus, level, role) {
  const pool = banks[focus === 'mixed' ? 'mixed' : focus];
  const offset = level === 'advanced' ? 3 : level === 'intermediate' ? 1 : 0;
  return Array.from({ length: 6 }, (_, i) => ({ number: i + 1, text: pool[(offset + i * 2) % pool.length].replaceAll('this role', role) }));
}
router.use(requireAuth);
router.post('/', async (req, res, next) => {
  try {
    const roleTitle = typeof req.body.roleTitle === 'string' ? req.body.roleTitle.trim() : '';
    const experienceLevel = req.body.experienceLevel;
    const focusArea = req.body.focusArea;
    if (roleTitle.length < 2 || roleTitle.length > 80) return res.status(400).json({ error: 'Role title must be 2 to 80 characters.' });
    if (!levels.includes(experienceLevel)) return res.status(400).json({ error: 'Choose a valid experience level.' });
    if (!focuses.includes(focusArea)) return res.status(400).json({ error: 'Choose a valid focus area.' });
    const questions = pickQuestions(focusArea, experienceLevel, roleTitle);
    const id = randomUUID();
    const { data: session, error: sessionError } = await supabase.from('interview_sessions').insert({ id, user_id: req.user.id, role_title: roleTitle, experience_level: experienceLevel, focus_area: focusArea }).select('id,role_title,experience_level,focus_area,status,started_at').single();
    if (sessionError) throw sessionError;
    const rows = questions.map(q => ({ session_id: id, question_number: q.number, question_text: q.text }));
    const { data: savedAnswers, error: answersError } = await supabase.from('interview_answers').insert(rows).select('id,question_number,question_text,answer_text,self_rating');
    if (answersError) {
      await supabase.from('interview_sessions').delete().eq('id', id).eq('user_id', req.user.id);
      throw answersError;
    }
    res.status(201).json({ session, questions: savedAnswers.map(a => ({ number: a.question_number, text: a.question_text, id: a.id, answerText: a.answer_text, selfRating: a.self_rating })) });
  } catch (error) { next(error); }
});
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('interview_sessions').select('id,role_title,experience_level,focus_area,status,started_at,completed_at').eq('user_id', req.user.id).order('started_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ sessions: data });
  } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const { data: session, error } = await supabase.from('interview_sessions').select('id,user_id,role_title,experience_level,focus_area,status,started_at,completed_at').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!session) return res.status(404).json({ error: 'Interview session not found.' });
    const { data: answers, error: answerError } = await supabase.from('interview_answers').select('id,question_number,question_text,answer_text,self_rating,updated_at').eq('session_id', session.id).order('question_number');
    if (answerError) throw answerError;
    res.json({ session: { ...session, user_id: undefined }, answers });
  } catch (error) { next(error); }
});
router.put('/:id/answers/:answerId', async (req, res, next) => {
  try {
    const answerText = typeof req.body.answerText === 'string' ? req.body.answerText.trim() : null;
    const rating = req.body.selfRating === null || req.body.selfRating === undefined || req.body.selfRating === '' ? null : Number(req.body.selfRating);
    if (answerText === null || answerText.length > 5000) return res.status(400).json({ error: 'Answer must be text up to 5,000 characters.' });
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return res.status(400).json({ error: 'Self-rating must be from 1 to 5.' });
    const { data: owned, error: ownerError } = await supabase.from('interview_sessions').select('id,status').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (ownerError) throw ownerError;
    if (!owned) return res.status(404).json({ error: 'Interview session not found.' });
    if (owned.status === 'completed') return res.status(409).json({ error: 'Completed sessions are read-only.' });
    const { data, error } = await supabase.from('interview_answers').update({ answer_text: answerText, self_rating: rating }).eq('id', req.params.answerId).eq('session_id', owned.id).select('id,question_number,answer_text,self_rating,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Question not found in this session.' });
    res.json({ answer: data });
  } catch (error) { next(error); }
});
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('interview_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user.id).eq('status', 'in_progress').select('id,status,completed_at').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'In-progress session not found.' });
    res.json({ session: data });
  } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('interview_sessions').delete().eq('id', req.params.id).eq('user_id', req.user.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Interview session not found.' });
    res.status(204).end();
  } catch (error) { next(error); }
});
module.exports = router;








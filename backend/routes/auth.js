const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const supabase = require('../supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' });
}
router.post('/register', authLimit, async (req, res, next) => {
  try {
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (displayName.length < 2 || displayName.length > 60) return res.status(400).json({ error: 'Name must be 2 to 60 characters.' });
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 10 || password.length > 72) return res.status(400).json({ error: 'Password must be 10 to 72 characters.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from('app_users').insert({ display_name: displayName, email, password_hash: passwordHash }).select('id,email,display_name').single();
    if (error?.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    if (error) throw error;
    res.status(201).json({ token: issueToken(data), user: { id: data.id, email: data.email, displayName: data.display_name } });
  } catch (error) { next(error); }
});
router.post('/login', authLimit, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!emailPattern.test(email) || !password) return res.status(400).json({ error: 'Enter your email and password.' });
    const { data, error } = await supabase.from('app_users').select('id,email,display_name,password_hash').eq('email', email).maybeSingle();
    if (error) throw error;
    if (!data || !(await bcrypt.compare(password, data.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json({ token: issueToken(data), user: { id: data.id, email: data.email, displayName: data.display_name } });
  } catch (error) { next(error); }
});
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('app_users').select('id,email,display_name,created_at').eq('id', req.user.id).single();
    if (error) throw error;
    res.json({ user: { id: data.id, email: data.email, displayName: data.display_name, createdAt: data.created_at } });
  } catch (error) { next(error); }
});
module.exports = router;

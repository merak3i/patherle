import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = Router();

// Plan amounts in paise (INR × 100)
const PLAN_AMOUNTS = {
  starter:    99900,    // ₹999
  growth:    299900,    // ₹2,999
  enterprise: 999900,  // ₹9,999
};

// Plan labels for descriptions
const PLAN_LABELS = {
  starter:    'Starter — 1,000 messages/mo · 1 workspace',
  growth:     'Growth — 5,000 messages/mo · 5 workspaces',
  enterprise: 'Enterprise — 25,000 messages/mo · 15 workspaces',
};

// ─── Razorpay ─────────────────────────────────────────────────────────────────
/**
 * POST /api/payments/order
 * Creates a Razorpay order.
 * Body: { planId }
 */
router.post('/order', async (req, res) => {
  try {
    const { planId } = req.body;
    const amount = PLAN_AMOUNTS[planId];

    if (!amount) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Razorpay credentials not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `patherle_${planId}_${Date.now()}`,
      notes: { plan: PLAN_LABELS[planId] },
    });

    res.json(order);
  } catch (err) {
    console.error('Razorpay order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/verify
 * Verifies Razorpay payment signature after checkout.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post('/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) return res.status(503).json({ error: 'Not configured' });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expected === razorpay_signature) {
      res.json({ verified: true, payment_id: razorpay_payment_id });
    } else {
      res.status(400).json({ verified: false, error: 'Signature mismatch' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CoinDCX Pay ──────────────────────────────────────────────────────────────
/**
 * POST /api/payments/coindcx-order
 * Creates a CoinDCX Pay checkout session.
 * Body: { planId, email }
 *
 * CoinDCX Pay API: https://coindcx.com/api (merchant credentials required)
 * Set COINDCX_PAY_KEY and COINDCX_PAY_SECRET in .env
 */
router.post('/coindcx-order', async (req, res) => {
  try {
    const { planId, email } = req.body;
    const amountPaise = PLAN_AMOUNTS[planId];

    if (!amountPaise) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const key    = process.env.COINDCX_PAY_KEY;
    const secret = process.env.COINDCX_PAY_SECRET;

    if (!key || !secret) {
      return res.status(503).json({
        error: 'CoinDCX Pay credentials not configured. Add COINDCX_PAY_KEY and COINDCX_PAY_SECRET to .env',
      });
    }

    const amountINR = amountPaise / 100;
    const orderId   = `patherle_${planId}_${Date.now()}`;

    // CoinDCX Pay — create payment order
    // Docs: https://docs.coindcx.com (Merchant Pay section)
    const payload = JSON.stringify({
      order_id: orderId,
      amount: amountINR,
      currency: 'INR',
      description: PLAN_LABELS[planId],
      customer_email: email || '',
      redirect_url: process.env.COINDCX_REDIRECT_URL || `${process.env.FRONTEND_URL || 'http://localhost:5173'}?payment=success`,
      webhook_url: process.env.COINDCX_WEBHOOK_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payments/coindcx-webhook`,
    });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const response = await fetch('https://api.coindcx.com/pay/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': key,
        'X-AUTH-SIGNATURE': signature,
      },
      body: payload,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'CoinDCX Pay order creation failed');
    }

    // CoinDCX Pay returns a checkout_url to redirect the user to
    res.json({ checkout_url: data.checkout_url, order_id: orderId });
  } catch (err) {
    console.error('CoinDCX Pay error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/coindcx-webhook
 * Receives CoinDCX Pay payment confirmation webhook.
 */
router.post('/coindcx-webhook', (req, res) => {
  try {
    const secret    = process.env.COINDCX_PAY_SECRET || '';
    const signature = req.headers['x-coindcx-signature'] || '';
    const body      = JSON.stringify(req.body);

    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature && expected !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { order_id, status, txn_id } = req.body;
    console.log(`CoinDCX Pay webhook: order=${order_id} status=${status} txn=${txn_id}`);

    // TODO: update your database with payment status here
    // e.g. supabase.from('subscriptions').upsert({ order_id, status, txn_id })

    res.json({ received: true });
  } catch (err) {
    console.error('CoinDCX webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import Razorpay from 'razorpay';

const router = Router();

const PLAN_AMOUNTS = {
  starter: 99900,    // ₹999 in paise
  growth: 299900,    // ₹2999 in paise
  enterprise: 999900, // ₹9999 in paise
};

/**
 * POST /api/payments/order
 * Creates a Razorpay order for the selected plan.
 * Body: { planId, amount? }
 */
router.post('/order', async (req, res) => {
  try {
    const { planId } = req.body;
    const amount = PLAN_AMOUNTS[planId];

    if (!amount) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `plan_${planId}_${Date.now()}`,
    });

    res.json(order);
  } catch (err) {
    console.error('Payment order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

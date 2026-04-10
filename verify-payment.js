/**
 * Razorpay Payment Verification Endpoint
 * This file handles the verification of Razorpay payments
 * Deploy this on your backend (Node.js, Express, or serverless function)
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Environment Variables
const RAZORPAY_KEY_SECRET = rzp_test_SbeZZF7XaWPDvx;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@studytemplates.com';
const DOWNLOAD_LINK_BASE = process.env.DOWNLOAD_LINK_BASE || 'https://studytemplates.com/downloads';

// Configure Email Service
const emailConfig = {
    service: 'gmail', // or your email service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
};

const transporter = nodemailer.createTransport(emailConfig);

// ============================================
// VERIFY PAYMENT SIGNATURE
// ============================================
function verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    return expectedSignature === razorpaySignature;
}

// ============================================
// GET DOWNLOAD LINK BASED ON PACKAGE
// ============================================
function getDownloadLink(packageName) {
    const downloadLinks = {
        'Basic Pack': `${DOWNLOAD_LINK_BASE}/basic-pack.zip`,
        'Premium Pack': `${DOWNLOAD_LINK_BASE}/premium-pack.zip`,
        'Ultimate Student Pack': `${DOWNLOAD_LINK_BASE}/ultimate-pack.zip`
    };

    return downloadLinks[packageName] || `${DOWNLOAD_LINK_BASE}/basic-pack.zip`;
}

// ============================================
// SEND CONFIRMATION EMAIL
// ============================================
async function sendConfirmationEmail(userEmail, packageName, paymentId, downloadLink) {
    const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px; border-radius: 12px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: white; padding: 30px; }
            .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
            .footer { color: #666; font-size: 12px; text-align: center; padding: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Thank You for Your Purchase! 🎉</h1>
                <p>Your StudyTemplates are ready to download</p>
            </div>
            
            <div class="content">
                <h2>Order Confirmation</h2>
                <p>Hi there,</p>
                
                <p>Thank you for purchasing the <strong>${packageName}</strong> from StudyTemplates!</p>
                
                <p><strong>Order Details:</strong></p>
                <ul>
                    <li><strong>Package:</strong> ${packageName}</li>
                    <li><strong>Payment ID:</strong> ${paymentId}</li>
                    <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
                </ul>
                
                <p><strong>Your templates are ready to download:</strong></p>
                <a href="${downloadLink}" class="btn">📥 Download Your Templates</a>
                
                <p><strong>What's Inside:</strong></p>
                <ul>
                    <li>✓ Cornell Notes Template</li>
                    <li>✓ Daily Study Planner</li>
                    ${packageName.includes('Premium') || packageName.includes('Ultimate') ? '<li>✓ Revision Tracker</li>' : ''}
                    ${packageName.includes('Premium') || packageName.includes('Ultimate') ? '<li>✓ Focus Study Sheet</li>' : ''}
                    ${packageName.includes('Ultimate') ? '<li>✓ Bonus Planning Templates</li>' : ''}
                </ul>
                
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>Download the ZIP file from the link above</li>
                    <li>Extract all files on your computer</li>
                    <li>Open the PDFs with your preferred PDF reader</li>
                    <li>Print or use digitally on iPad with apps like GoodNotes or Notability</li>
                </ol>
                
                <p><strong>Need Help?</strong></p>
                <p>Reply to this email or contact us at ${ADMIN_EMAIL}</p>
                
                <p>Happy studying! 📚</p>
            </div>
            
            <div class="footer">
                <p>© 2026 StudyTemplates. All rights reserved.</p>
                <p>This is an automated email. Please don't reply with support issues. Contact ${ADMIN_EMAIL} instead.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        await transporter.sendMail({
            from: ADMIN_EMAIL,
            to: userEmail,
            subject: `🎉 Your StudyTemplates ${packageName} is Ready!`,
            html: emailTemplate
        });

        console.log(`✅ Email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
}

// ============================================
// SEND ADMIN NOTIFICATION
// ============================================
async function sendAdminNotification(userData) {
    const emailTemplate = `
    <h2>New Purchase Notification</h2>
    <p><strong>Package:</strong> ${userData.package_name}</p>
    <p><strong>Amount:</strong> ₹${userData.package_amount}</p>
    <p><strong>Payment ID:</strong> ${userData.razorpay_payment_id}</p>
    <p><strong>Order ID:</strong> ${userData.razorpay_order_id}</p>
    <p><strong>Timestamp:</strong> ${userData.timestamp}</p>
    `;

    try {
        await transporter.sendMail({
            from: ADMIN_EMAIL,
            to: ADMIN_EMAIL,
            subject: `New Purchase: ${userData.package_name}`,
            html: emailTemplate
        });

        console.log('✅ Admin notification sent');
        return true;
    } catch (error) {
        console.error('Admin email failed:', error);
        return false;
    }
}

// ============================================
// MAIN VERIFICATION HANDLER (Express)
// ============================================
async function verifyPaymentHandler(req, res) {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            package_name,
            package_amount
        } = req.body;

        // Validate required fields
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }

        // Verify signature
        const isSignatureValid = verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isSignatureValid) {
            console.error('❌ Invalid signature');
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Signature is valid
        console.log('✅ Signature verified');

        // Get download link
        const downloadLink = getDownloadLink(package_name);

        // Get user email from request (you should validate this)
        const userEmail = req.body.email || req.user?.email;

        // Send confirmation emails
        if (userEmail) {
            await sendConfirmationEmail(userEmail, package_name, razorpay_payment_id, downloadLink);
        }

        // Send admin notification
        await sendAdminNotification(req.body);

        // Log transaction (save to database)
        // await saveTransaction({
        //     razorpay_payment_id,
        //     razorpay_order_id,
        //     package_name,
        //     package_amount,
        //     user_email: userEmail,
        //     timestamp: new Date()
        // });

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            download_link: downloadLink,
            payment_id: razorpay_payment_id
        });

    } catch (error) {
        console.error('Verification Error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during verification'
        });
    }
}

// ============================================
// EXPRESS ROUTE HANDLER
// ============================================
// Use this in your Express app:
// app.post('/api/verify-payment', verifyPaymentHandler);

module.exports = {
    verifyPaymentHandler,
    verifyPaymentSignature,
    getDownloadLink,
    sendConfirmationEmail,
    sendAdminNotification
};

# FarmConnect Backend Setup

## Prerequisites
- Node.js (v14+ recommended)
- MySQL Server

## 1. Install Dependencies
```
npm install
```

## 2. Configure Environment Variables
Create a `.env` file in the project root with your Gmail credentials for OTP email:
```
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-app-password
```
> **Note:** If you have 2-Step Verification enabled on your Google account, you must use an [App Password](https://support.google.com/accounts/answer/185833?hl=en) for `EMAIL_PASS`.

## 3. Database Setup
The backend will automatically create the `farmconnect` database and all required tables on first run. If you want to manually inspect or reset the schema, use the provided `farmconnect.sql` file.

## 4. Start the Server
```
npm start
```
The server will run on [http://localhost:3000](http://localhost:3000).

## 5. Test Registration and OTP
- Go to `http://localhost:3000/register.html` in your browser.
- Register a new account. You will receive an OTP email to the address you provided.
- Enter the OTP to verify your email.
- If you do not receive the OTP, check your spam folder or use the "Resend OTP" link.

## Troubleshooting
- Ensure your Gmail credentials are correct and App Password is used if 2FA is enabled.
- MySQL server must be running locally with user `root` and no password (or update the connection settings in `server.js`).

## SQL Schema
See `farmconnect.sql` for the full database schema. 
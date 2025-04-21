import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/ForgotPassword.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const navigate = useNavigate();

    const handleRequestReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('http://localhost:8080/request-password-reset', { email });
            setLoading(false);
            setStep(2);
            setShowWarning(true);
        } catch (error) {
            setLoading(false);
            console.error('There was an error requesting the password reset!', error);
        }
    };

    const handleVerifyResetCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('http://localhost:8080/verify-reset-code', { email, resetCode });
            setLoading(false);
            setStep(3);
        } catch (error) {
            setLoading(false);
            console.error('There was an error verifying the reset code!', error);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('http://localhost:8080/reset-password', { email, newPassword });
            setLoading(false);
            alert('Password reset successfully');
            navigate('/login');
        } catch (error) {
            setLoading(false);
            console.error('There was an error resetting the password!', error);
        }
    };

    return (
        <div className="forgot-password-container">
            {step === 1 && (
                <form className="forgot-password-form" onSubmit={handleRequestReset}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
                    <button type="submit" disabled={loading}>
                        {loading ? <div className="spinner"></div> : 'Request Reset Code'}
                    </button>
                    {showWarning && (
                        <div className="warning-message">
                            If you don't receive the email, please check your spam folder.
                        </div>
                    )}
                </form>
            )}
            {step === 2 && (
                <form className="forgot-password-form" onSubmit={handleVerifyResetCode}>
                    <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="Reset Code" required />
                    <button type="submit" disabled={loading}>
                        {loading ? <div className="spinner"></div> : 'Verify Reset Code'}
                    </button>
                </form>
            )}
            {step === 3 && (
                <form className="forgot-password-form" onSubmit={handleResetPassword}>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" required />
                    <button type="submit" disabled={loading}>
                        {loading ? <div className="spinner"></div> : 'Reset Password'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default ForgotPassword;
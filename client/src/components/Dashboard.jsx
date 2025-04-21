import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [students, setStudents] = useState([]);
    const [user, setUser] = useState({});
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [modalType, setModalType] = useState('');
    const [certificateFile, setCertificateFile] = useState(null);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', unique_code: '', role: 'franchise-admin' });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:8080/students', {
                    headers: { 'x-access-token': token }
                });
                setStudents(response.data);
            } catch (error) {
                console.error('There was an error fetching the students!', error);
            }
        };

        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:8080/user', {
                    headers: { 'x-access-token': token }
                });
                setUser(response.data);
            } catch (error) {
                console.error('There was an error fetching the user data!', error);
            }
        };

        fetchStudents();
        fetchUser();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleEditClick = (student, type) => {
        setSelectedStudent(student);
        setModalType(type);
        setNewStatus(type === 'payment' ? student.payment_status : student.completion_status);
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token');
            if (modalType === 'payment') {
                await axios.put(`http://localhost:8080/students/${selectedStudent.id}/payment-status`, { payment_status: newStatus }, {
                    headers: { 'x-access-token': token }
                });
            } else {
                await axios.put(`http://localhost:8080/students/${selectedStudent.id}/completion-status`, { completion_status: newStatus }, {
                    headers: { 'x-access-token': token }
                });
            }
            setSelectedStudent(null);
            setModalType('');
            setNewStatus('');
            // Refresh students list
            const response = await axios.get('http://localhost:8080/students', {
                headers: { 'x-access-token': token }
            });
            setStudents(response.data);
        } catch (error) {
            console.error('There was an error updating the status!', error);
        }
    };

    const handleFileChange = (e) => {
        setCertificateFile(e.target.files[0]);
    };

    const handleUploadCertificate = async () => {
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('certificate', certificateFile);

            await axios.post(`http://localhost:8080/students/${selectedStudent.id}/upload-certificate`, formData, {
                headers: {
                    'x-access-token': token,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setSelectedStudent(null);
            setCertificateFile(null);
            // Refresh students list
            const response = await axios.get('http://localhost:8080/students', {
                headers: { 'x-access-token': token }
            });
            setStudents(response.data);
        } catch (error) {
            console.error('There was an error uploading the certificate!', error);
        }
    };

    const handleNewUserChange = (e) => {
        const { name, value } = e.target;
        setNewUser(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:8080/users', newUser, {
                headers: { 'x-access-token': token }
            });
            setNewUser({ name: '', email: '', password: '', unique_code: '', role: 'franchise-admin' });
            alert('User created successfully');
        } catch (error) {
            console.error('There was an error creating the user!', error);
        }
    };

    return (
        <div className="dashboard-container">
            <nav className="navbar">
                <div className="navbar-content">
                    <span className="navbar-item">Name: {user.name}</span>
                    <span className="navbar-item">Unique Code: {user.unique_code}</span>
                    <button className="navbar-item logout-button" onClick={handleLogout}>Logout</button>
                </div>
            </nav>
            <div className="dashboard-header">
                <h1>Dashboard</h1>
                {user.role === 'admin' && (
                    <>
                        <button onClick={() => setModalType('create-user')}>Create New User</button>
                        <a href="/users">View Users</a>
                    </>
                )}
            </div>
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Course</th>
                        <th>Payment Status</th>
                        <th>Completion Status</th>
                        <th>Certificate</th>
                        {user.role === 'admin' && <th>Franchise Name</th>}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(student => (
                        <tr key={student.id}>
                            <td>{student.name}</td>
                            <td>{student.course_name}</td>
                            <td>{student.payment_status}</td>
                            <td>{student.completion_status}</td>
                            <td>
                                {student.certificate_path && student.payment_status === 'Completed' && student.completion_status === 'Completed' ? (
                                    <a href={`http://localhost:8080/${student.certificate_path}`} download>Download Certificate</a>
                                ) : (
                                    'Not Available'
                                )}
                            </td>
                            {user.role === 'admin' && <td>{student.franchise_name}</td>}
                            <td>
                                {user.role === 'admin' && (
                                    <>
                                        <button className="edit-button" onClick={() => handleEditClick(student, 'payment')}>Edit Payment</button>
                                        <button className="edit-button" onClick={() => handleEditClick(student, 'certificate')}>Upload Certificate</button>
                                    </>
                                )}
                                {user.role === 'franchise-admin' && (
                                    <button className="edit-button" onClick={() => handleEditClick(student, 'completion')}>Edit Completion</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {selectedStudent && (
                <div className="modal">
                    <div className="modal-content">
                        {modalType === 'certificate' ? (
                            <>
                                <h2>Upload Certificate</h2>
                                <input type="file" onChange={handleFileChange} />
                                <button onClick={handleUploadCertificate}>Upload</button>
                                <button onClick={() => setSelectedStudent(null)}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <h2>Edit {modalType === 'payment' ? 'Payment Status' : 'Completion Status'}</h2>
                                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                </select>
                                <button onClick={handleSave}>Save</button>
                                <button onClick={() => setSelectedStudent(null)}>Cancel</button>
                            </>
                        )}
                    </div>
                </div>
            )}
            {modalType === 'create-user' && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Create New User</h2>
                        <form onSubmit={handleCreateUser}>
                            <input
                                type="text"
                                name="name"
                                value={newUser.name}
                                onChange={handleNewUserChange}
                                placeholder="Name"
                                required
                            />
                            <input
                                type="email"
                                name="email"
                                value={newUser.email}
                                onChange={handleNewUserChange}
                                placeholder="Email"
                                required
                            />
                            <input
                                type="password"
                                name="password"
                                value={newUser.password}
                                onChange={handleNewUserChange}
                                placeholder="Password"
                                required
                            />
                            <input
                                type="text"
                                name="unique_code"
                                value={newUser.unique_code}
                                onChange={handleNewUserChange}
                                placeholder="Unique Code"
                                required
                            />
                            <select name="role" value={newUser.role} onChange={handleNewUserChange}>
                                <option value="franchise-admin">Franchise Admin</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button type="submit">Create User</button>
                            <button type="button" onClick={() => setModalType('')}>Cancel</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
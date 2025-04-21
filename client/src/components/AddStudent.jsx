import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/AddStudent.css';

const AddStudent = () => {
    const [name, setName] = useState('');
    const [courseId, setCourseId] = useState('');
    const [courses, setCourses] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await axios.get('http://localhost:8080/courses');
                setCourses(response.data);
            } catch (error) {
                console.error('There was an error fetching the courses!', error);
            }
        };

        fetchCourses();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:8080/students', { name, course_id: courseId }, {
                headers: { 'x-access-token': token }
            });
            navigate('/dashboard');
        } catch (error) {
            console.error('There was an error adding the student!', error);
        }
    };

    return (
        <div className="add-student-container">
            <form className="add-student-form" onSubmit={handleSubmit}>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Student Name" required />
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
                    <option value="">Select Course</option>
                    {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.course_name}</option>
                    ))}
                </select>
                <button type="submit">Add Student</button>
            </form>
        </div>
    );
};

export default AddStudent;

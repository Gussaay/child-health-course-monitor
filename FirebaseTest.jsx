import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

export function FirebaseTest() {
  const [status, setStatus] = useState('Testing connection...');
  const [courses, setCourses] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Check user authentication
        const user = auth.currentUser;
        if (user) {
          const token = await user.getIdTokenResult();
          setUserInfo({
            email: user.email,
            uid: user.uid,
            isAdmin: token.claims.admin || false
          });
        }

        // Test courses collection access
        const querySnapshot = await getDocs(collection(db, "courses"));
        const coursesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCourses(coursesData);
        setStatus(`Connection successful! Found ${coursesData.length} courses.`);
      } catch (error) {
        setStatus(`Connection failed: ${error.message}`);
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Firebase Connection Test</h2>
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p className="font-semibold">Status: {status}</p>
        {userInfo && (
          <div className="mt-2">
            <p>User: {userInfo.email}</p>
            <p>UID: {userInfo.uid}</p>
            <p>Admin: {userInfo.isAdmin ? 'Yes' : 'No'}</p>
          </div>
        )}
      </div>
      {courses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Courses:</h3>
          <div className="grid gap-2">
            {courses.map(course => (
              <div key={course.id} className="p-3 bg-white border rounded">
                <p className="font-semibold">{course.title || 'Untitled Course'}</p>
                <p>Type: {course.course_type}</p>
                <p>ID: {course.id}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
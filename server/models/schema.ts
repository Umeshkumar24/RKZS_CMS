// schema.ts
import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    boolean,
    unique, // For unique constraints
    integer // For foreign keys
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm'; // For defining relationships


// --- Users Table ---
export const users = pgTable('users', {
    id: serial('id').primaryKey(), // Auto-incrementing primary key
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(), // Email should be unique
    password: varchar('password', { length: 255 }).notNull(), // Store hashed passwords!
    uniqueCode: varchar('unique_code', { length: 255 }), // Assuming unique_code is not necessarily unique in DB
    role: varchar('role', { length: 50 }).notNull().default('franchise-admin'), // e.g., 'admin', 'franchise-admin'
    resetCode: varchar('reset_code', { length: 255 }), // Nullable
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(), // Good practice to have timestamps
}, (table) => {
    return {
        // Optional: Add a unique index on unique_code if it must be unique
        // uniqueCodeUnique: unique('unique_code_unique').on(table.uniqueCode),
    }
});

// Define relationships if needed (e.g., a user can have many students if role is 'franchise-admin')
export const usersRelations = relations(users, ({ many }) => ({
    addedStudents: many(students),
}));


// --- Courses Table ---
export const courses = pgTable('courses', {
    id: serial('id').primaryKey(), // Auto-incrementing primary key
    courseName: varchar('course_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define relationships if needed (e.g., a course can have many students)
export const coursesRelations = relations(courses, ({ many }) => ({
    students: many(students),
}));


// --- Students Table ---
export const students = pgTable('students', {
    id: serial('id').primaryKey(), // Auto-incrementing primary key
    name: varchar('name', { length: 255 }).notNull(),
    courseId: integer('course_id').notNull().references(() => courses.id), // Foreign key to courses
    franchiseId: integer('franchise_id').notNull().references(() => users.id), // Foreign key to users (franchise admin)
    paymentStatus: varchar('payment_status', { length: 50 }).default('pending').notNull(), // e.g., 'pending', 'paid'
    completionStatus: varchar('completion_status', { length: 50 }).default('pending').notNull(), // e.g., 'pending', 'completed'
    certificatePath: text('certificate_path'), // Path to the uploaded certificate, can be null
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define relationships
export const studentsRelations = relations(students, ({ one }) => ({
    course: one(courses, {
        fields: [students.courseId],
        references: [courses.id],
    }),
    franchise: one(users, {
        fields: [students.franchiseId],
        references: [users.id],
    }),
}));

// Note: This schema includes fields implied by your queries.
// You might need to add more fields based on your application's full requirements.
// Remember to store passwords securely (hashed) in the 'password' field.
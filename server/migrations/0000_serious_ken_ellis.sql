CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"course_id" integer NOT NULL,
	"franchise_id" integer NOT NULL,
	"payment_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"completion_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"certificate_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"unique_code" varchar(255),
	"role" varchar(50) DEFAULT 'franchise-admin' NOT NULL,
	"reset_code" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_franchise_id_users_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
import json
import tkinter as tk
from tkinter import messagebox, scrolledtext

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:
    plt = None

FILE_NAME = "students_data.json"


def load_students():
    try:
        with open(FILE_NAME, "r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

    if not isinstance(data, dict):
        return {}

    students = {}
    for student_name, record in data.items():
        if not isinstance(record, dict):
            continue
        subjects = record.get("subjects", {})
        cleaned_subjects = {}
        if isinstance(subjects, dict):
            for subject, marks in subjects.items():
                if isinstance(marks, dict):
                    cleaned_subjects[str(subject).strip().title()] = {
                        "total": int(marks.get("total", 0)),
                        "obtained": int(marks.get("obtained", 0)),
                    }
        students[str(student_name).strip().title()] = {"subjects": cleaned_subjects}
    return students


def save_students(students):
    data = {}
    for student_name, record in students.items():
        data[student_name] = {
            "subjects": {
                subject_name: {
                    "total": int(marks.get("total", 0)),
                    "obtained": int(marks.get("obtained", 0)),
                }
                for subject_name, marks in record.get("subjects", {}).items()
            }
        }
    with open(FILE_NAME, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def normalize_name(value):
    return str(value).strip().title()


def get_student_percentage(student_record):
    subjects = student_record.get("subjects", {})
    total_marks = 0
    obtained_marks = 0
    for marks in subjects.values():
        total_marks += int(marks.get("total", 0))
        obtained_marks += int(marks.get("obtained", 0))
    if total_marks == 0:
        return 0.0
    return (obtained_marks / total_marks) * 100


def get_valid_int(value):
    try:
        return int(value)
    except ValueError:
        return None


class StudentManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("School Student Record Manager")
        self.root.geometry("900x650")
        self.root.configure(bg="#eef4ff")
        self.root.resizable(False, False)
        self.students = load_students()

        self.root.attributes("-fullscreen", False)

        self.window_controls = tk.Frame(root, bg="#eef4ff")
        self.window_controls.pack(anchor="ne", padx=18, pady=(10, 0), fill="x")

        self.fullscreen_button = tk.Button(
            self.window_controls,
            text="Full Screen",
            command=self.toggle_fullscreen,
            font=("Arial", 9, "bold"),
            bg="#2d6a4f",
            fg="white",
            bd=0,
            activebackground="#1f4d3c",
            cursor="hand2",
            width=12,
        )
        self.fullscreen_button.pack(side="right")

        self.minimize_button = tk.Button(
            self.window_controls,
            text="Minimize",
            command=self.minimize_window,
            font=("Arial", 9, "bold"),
            bg="#495057",
            fg="white",
            bd=0,
            activebackground="#343a40",
            cursor="hand2",
            width=10,
        )
        self.minimize_button.pack(side="right", padx=(0, 8))

        self.close_button = tk.Button(
            self.window_controls,
            text="Exit",
            command=self.root.destroy,
            font=("Arial", 9, "bold"),
            bg="#d9534f",
            fg="white",
            bd=0,
            activebackground="#b52b2b",
            cursor="hand2",
            width=8,
        )
        self.close_button.pack(side="right", padx=(0, 8))

        self.title_label = tk.Label(root, text="Student Record Manager", font=("Arial", 22, "bold"), fg="#123456", bg="#eef4ff")
        self.title_label.pack(pady=(10, 15))

        self.content_frame = tk.Frame(root, bg="#eef4ff")
        self.content_frame.pack(fill="both", expand=True, padx=20, pady=10)

        self.status = tk.Label(root, text="Ready", font=("Arial", 10, "bold"), fg="#2d6a4f", bg="#eef4ff")
        self.status.pack(pady=(0, 10))

        self.footer_label = tk.Label(
            root,
            text="Designed by Abdullah Ibrahim",
            font=("Arial", 9, "bold"),
            fg="#3f4d5c",
            bg="#eef4ff",
            anchor="e"
        )
        self.footer_label.pack(anchor="e", padx=18, pady=(0, 10))

        self.show_dashboard()

    def minimize_window(self):
        self.root.iconify()

    def toggle_fullscreen(self):
        current = self.root.attributes("-fullscreen")
        self.root.attributes("-fullscreen", not current)
        self.fullscreen_button.config(text="Exit Full Screen" if not current else "Full Screen")

    def clear_content(self):
        for widget in self.content_frame.winfo_children():
            widget.destroy()

    def show_dashboard(self):
        self.clear_content()

        dashboard = tk.Frame(self.content_frame, bg="#eef4ff")
        dashboard.pack(fill="both", expand=True)

        buttons = [
            ("Add Student", self.open_add_student_view),
            ("Add Subject", self.open_add_subject_view),
            ("Search Student", self.open_search_view),
            ("Update Student Info", self.open_update_view),
            ("Delete Student", self.open_delete_view),
            ("View All Students", self.open_all_students_view),
            ("Show Graph", self.open_graph_view),
            ("Exit", self.root.destroy),
        ]

        for text, command in buttons:
            tk.Button(
                dashboard,
                text=text,
                command=command,
                width=26,
                height=2,
                font=("Arial", 11, "bold"),
                bg="#4f6ef7",
                fg="white",
                bd=0,
                activebackground="#3d5ae0",
                cursor="hand2",
            ).pack(pady=6)

    def bind_enter_navigation(self, widgets, submit_callback=None):
        for index, widget in enumerate(widgets):
            def handle_enter(event, next_widget=widgets[index + 1] if index + 1 < len(widgets) else None):
                if next_widget is not None:
                    next_widget.focus_set()
                    next_widget.icursor(tk.END)
                    return "break"
                if submit_callback is not None:
                    submit_callback()
                    return "break"
                return "break"

            widget.bind("<Return>", handle_enter)

    def add_back_button(self, parent):
        tk.Button(
            parent,
            text="Back",
            command=self.show_dashboard,
            width=18,
            height=2,
            font=("Arial", 10, "bold"),
            bg="#495057",
            fg="white",
            bd=0,
            activebackground="#6c757d",
            cursor="hand2",
        ).pack(pady=(12, 0))

    def add_graph_back_button(self, parent):
        btn = tk.Button(
            parent,
            text="←",
            command=self.show_dashboard,
            width=3,
            height=1,
            font=("Arial", 14, "bold"),
            bg="#495057",
            fg="white",
            bd=0,
            activebackground="#6c757d",
            cursor="hand2",
        )
        btn.pack(anchor="nw", pady=(0, 8))

    def open_add_student_view(self):
        self.clear_content()
        form = tk.Frame(self.content_frame, bg="#eef4ff")
        form.pack(fill="both", expand=True, padx=50, pady=20)

        tk.Label(form, text="Add Student", font=("Arial", 20, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 15))

        fields = [
            ("Student Name", "student_name"),
            ("Subject Name", "subject_name"),
            ("Total Marks", "total_marks"),
            ("Obtained Marks", "obtained_marks"),
        ]

        entries = {}
        for label_text, key in fields:
            tk.Label(form, text=label_text, bg="#eef4ff", font=("Arial", 11, "bold"), anchor="w").pack(fill="x", pady=(8, 3))
            entry = tk.Entry(form, font=("Arial", 12), width=35)
            entry.pack(fill="x", pady=(0, 6))
            entries[key] = entry

        def save_student():
            student_name = normalize_name(entries["student_name"].get())
            subject_name = normalize_name(entries["subject_name"].get())
            total = get_valid_int(entries["total_marks"].get())
            obtained = get_valid_int(entries["obtained_marks"].get())

            if not student_name:
                messagebox.showerror("Error", "Student name is required.")
                return
            if not subject_name:
                messagebox.showerror("Error", "Subject name is required.")
                return
            if total is None or obtained is None:
                messagebox.showerror("Error", "Marks must be valid numbers.")
                return
            if obtained > total:
                messagebox.showerror("Error", "Obtained marks cannot be greater than total marks.")
                return
            if student_name in self.students:
                messagebox.showerror("Error", f"{student_name} already exists.")
                return

            self.students[student_name] = {"subjects": {subject_name: {"total": total, "obtained": obtained}}}
            save_students(self.students)
            self.status.config(text=f"Student {student_name} added.")
            messagebox.showinfo("Success", f"Student {student_name} added successfully.")
            self.show_dashboard()

        entry_widgets = [entries["student_name"], entries["subject_name"], entries["total_marks"], entries["obtained_marks"]]
        self.bind_enter_navigation(entry_widgets, save_student)

        tk.Button(form, text="Save Student", command=save_student, width=20, height=2, font=("Arial", 11, "bold"), bg="#2a9d8f", fg="white", bd=0).pack(pady=15)
        self.add_back_button(form)

    def open_add_subject_view(self):
        self.clear_content()
        form = tk.Frame(self.content_frame, bg="#eef4ff")
        form.pack(fill="both", expand=True, padx=50, pady=20)

        tk.Label(form, text="Add Subject", font=("Arial", 20, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 15))

        entries = {}
        for label_text, key in [("Student Name", "student_name"), ("Subject Name", "subject_name"), ("Total Marks", "total_marks"), ("Obtained Marks", "obtained_marks")]:
            tk.Label(form, text=label_text, bg="#eef4ff", font=("Arial", 11, "bold"), anchor="w").pack(fill="x", pady=(8, 3))
            entry = tk.Entry(form, font=("Arial", 12), width=35)
            entry.pack(fill="x", pady=(0, 6))
            entries[key] = entry

        def save_subject():
            student_name = normalize_name(entries["student_name"].get())
            subject_name = normalize_name(entries["subject_name"].get())
            total = get_valid_int(entries["total_marks"].get())
            obtained = get_valid_int(entries["obtained_marks"].get())

            if not student_name:
                messagebox.showerror("Error", "Student name is required.")
                return
            if not subject_name:
                messagebox.showerror("Error", "Subject name is required.")
                return
            if total is None or obtained is None:
                messagebox.showerror("Error", "Marks must be valid numbers.")
                return
            if obtained > total:
                messagebox.showerror("Error", "Obtained marks cannot be greater than total marks.")
                return
            if student_name not in self.students:
                messagebox.showerror("Error", "Student not found.")
                return

            self.students[student_name]["subjects"][subject_name] = {"total": total, "obtained": obtained}
            save_students(self.students)
            self.status.config(text=f"Subject {subject_name} added for {student_name}.")
            messagebox.showinfo("Success", f"Subject {subject_name} added for {student_name}.")
            self.show_dashboard()

        entry_widgets = [entries["student_name"], entries["subject_name"], entries["total_marks"], entries["obtained_marks"]]
        self.bind_enter_navigation(entry_widgets, save_subject)

        tk.Button(form, text="Save Subject", command=save_subject, width=20, height=2, font=("Arial", 11, "bold"), bg="#2a9d8f", fg="white", bd=0).pack(pady=15)
        self.add_back_button(form)

    def open_search_view(self):
        self.clear_content()
        form = tk.Frame(self.content_frame, bg="#eef4ff")
        form.pack(fill="both", expand=True, padx=50, pady=20)

        tk.Label(form, text="Search Student", font=("Arial", 20, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 15))
        tk.Label(form, text="Student Name", bg="#eef4ff", font=("Arial", 11, "bold"), anchor="w").pack(fill="x")
        entry = tk.Entry(form, font=("Arial", 12), width=35)
        entry.pack(fill="x", pady=(0, 10))

        result = scrolledtext.ScrolledText(form, width=50, height=14, font=("Consolas", 10))
        result.pack(fill="both", expand=True)

        def search_student():
            student_name = normalize_name(entry.get())
            if not student_name:
                messagebox.showerror("Error", "Student name is required.")
                return
            if student_name not in self.students:
                result.delete("1.0", tk.END)
                result.insert(tk.END, "Student not found.")
                self.status.config(text="Student not found.")
                return

            student = self.students[student_name]
            subjects = student.get("subjects", {})
            total_full = 0
            total_obtained = 0
            lines = [f"Student: {student_name}", "=" * 50]

            for subject_name, marks in sorted(subjects.items()):
                total = int(marks.get("total", 0))
                obtained = int(marks.get("obtained", 0))
                total_full += total
                total_obtained += obtained
                percentage = 0 if total == 0 else (obtained / total) * 100
                lines.append(f"{subject_name}: {obtained}/{total} ({percentage:.2f}%)")

            overall = 0 if total_full == 0 else (total_obtained / total_full) * 100
            lines.append("-" * 50)
            lines.append(f"Overall Percentage: {overall:.2f}%")
            result.delete("1.0", tk.END)
            result.insert(tk.END, "\n".join(lines))
            self.status.config(text=f"Student {student_name} found.")

        self.bind_enter_navigation([entry], search_student)

        tk.Button(form, text="Search", command=search_student, width=18, height=2, font=("Arial", 11, "bold"), bg="#4f6ef7", fg="white", bd=0).pack(pady=10)
        self.add_back_button(form)

    def open_update_view(self):
        self.clear_content()
        form = tk.Frame(self.content_frame, bg="#eef4ff")
        form.pack(fill="both", expand=True, padx=50, pady=20)

        tk.Label(form, text="Update Student Info", font=("Arial", 20, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 15))

        entries = {}
        for label_text, key in [("Student Name", "student_name"), ("Subject Name", "subject_name"), ("Total Marks", "total_marks"), ("Obtained Marks", "obtained_marks")]:
            tk.Label(form, text=label_text, bg="#eef4ff", font=("Arial", 11, "bold"), anchor="w").pack(fill="x", pady=(8, 3))
            entry = tk.Entry(form, font=("Arial", 12), width=35)
            entry.pack(fill="x", pady=(0, 6))
            entries[key] = entry

        def update_student():
            student_name = normalize_name(entries["student_name"].get())
            subject_name = normalize_name(entries["subject_name"].get())
            total = get_valid_int(entries["total_marks"].get())
            obtained = get_valid_int(entries["obtained_marks"].get())

            if not student_name:
                messagebox.showerror("Error", "Student name is required.")
                return
            if student_name not in self.students:
                messagebox.showerror("Error", "Student not found.")
                return
            if not subject_name:
                messagebox.showerror("Error", "Subject name is required.")
                return
            if total is None or obtained is None:
                messagebox.showerror("Error", "Marks must be valid numbers.")
                return
            if obtained > total:
                messagebox.showerror("Error", "Obtained marks cannot be greater than total marks.")
                return

            self.students[student_name]["subjects"][subject_name] = {"total": total, "obtained": obtained}
            save_students(self.students)
            self.status.config(text=f"Student {student_name} updated.")
            messagebox.showinfo("Success", f"Student {student_name} information updated.")
            self.show_dashboard()

        entry_widgets = [entries["student_name"], entries["subject_name"], entries["total_marks"], entries["obtained_marks"]]
        self.bind_enter_navigation(entry_widgets, update_student)

        tk.Button(form, text="Update Information", command=update_student, width=20, height=2, font=("Arial", 11, "bold"), bg="#4f6ef7", fg="white", bd=0).pack(pady=15)
        self.add_back_button(form)

    def open_delete_view(self):
        self.clear_content()
        form = tk.Frame(self.content_frame, bg="#eef4ff")
        form.pack(fill="both", expand=True, padx=50, pady=20)

        tk.Label(form, text="Delete Student", font=("Arial", 20, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 15))
        tk.Label(form, text="Student Name", bg="#eef4ff", font=("Arial", 11, "bold"), anchor="w").pack(fill="x")
        entry = tk.Entry(form, font=("Arial", 12), width=35)
        entry.pack(fill="x", pady=(0, 10))

        def delete_student():
            student_name = normalize_name(entry.get())
            if not student_name:
                messagebox.showerror("Error", "Student name is required.")
                return
            if student_name not in self.students:
                messagebox.showerror("Error", "Student not found.")
                return

            confirm = messagebox.askyesno("Confirm Delete", f"Delete {student_name}?")
            if confirm:
                del self.students[student_name]
                save_students(self.students)
                self.status.config(text=f"Student {student_name} deleted.")
                messagebox.showinfo("Deleted", f"Student {student_name} deleted.")
                self.show_dashboard()

        self.bind_enter_navigation([entry], delete_student)

        tk.Button(form, text="Delete Student", command=delete_student, width=20, height=2, font=("Arial", 11, "bold"), bg="#d9534f", fg="white", bd=0).pack(pady=10)
        self.add_back_button(form)

    def open_all_students_view(self):
        self.clear_content()
        group = tk.Frame(self.content_frame, bg="#eef4ff")
        group.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(group, text="All Students", font=("Arial", 20, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 12))
        output = scrolledtext.ScrolledText(group, width=105, height=25, font=("Consolas", 10))
        output.pack(fill="both", expand=True)

        if not self.students:
            output.insert(tk.END, "No students found.")
            self.add_back_button(group)
            return

        lines = []
        for student_name in sorted(self.students):
            record = self.students[student_name].get("subjects", {})
            if not record:
                lines.append(f"{student_name}\nSubjects: None\nTotals: None\nObtained: None\n")
                continue

            subjects = list(sorted(record.keys()))
            totals = [str(int(record[sub].get("total", 0))) for sub in subjects]
            obtained = [str(int(record[sub].get("obtained", 0))) for sub in subjects]

            lines.append(f"Student: {student_name}")
            lines.append("-" * 70)
            lines.append("Subjects: " + " | ".join(subjects))
            lines.append("Total:    " + " | ".join(totals))
            lines.append("Obtained: " + " | ".join(obtained))
            overall = get_student_percentage(record)
            lines.append(f"Overall: {overall:.2f}%")
            lines.append("")

        output.insert(tk.END, "\n".join(lines))
        self.add_back_button(group)

    def open_graph_view(self):
        self.clear_content()
        group = tk.Frame(self.content_frame, bg="#eef4ff")
        group.pack(fill="both", expand=True, padx=30, pady=20)

        if not self.students:
            tk.Label(group, text="No students found. Add some students first.", font=("Arial", 14, "bold"), fg="#123456", bg="#eef4ff").pack(pady=20)
            self.add_back_button(group)
            return

        if plt is None:
            tk.Label(group, text="Matplotlib is not installed. Run: pip install matplotlib", font=("Arial", 12), fg="#b22222", bg="#eef4ff", wraplength=400, justify="left").pack(pady=20)
            self.add_back_button(group)
            return

        names = []
        percentages = []
        for student_name in sorted(self.students):
            names.append(student_name)
            percentages.append(get_student_percentage(self.students[student_name]))

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.bar(names, percentages, color="#4f6ef7")
        ax.axhline(50, color="red", linestyle="--", linewidth=1)
        ax.set_title("Student Performance Graph")
        ax.set_ylabel("Percentage (%)")
        ax.set_ylim(0, 100)
        ax.tick_params(axis="x", rotation=15)

        for i, value in enumerate(percentages):
            ax.text(i, value + 2, f"{value:.1f}%", ha="center")

        fig.tight_layout()
        output_file = "student_performance_graph.png"
        fig.savefig(output_file)
        plt.close(fig)

        self.graph_image = tk.PhotoImage(file=output_file)
        self.add_graph_back_button(group)
        graph_label = tk.Label(group, image=self.graph_image, bg="#eef4ff")
        graph_label.pack(pady=(0, 12), fill="both", expand=True)

        tk.Label(group, text="Graph Created Successfully", font=("Arial", 18, "bold"), fg="#123456", bg="#eef4ff").pack(pady=(0, 10))
        tk.Label(group, text=f"Saved as: {output_file}", font=("Arial", 11), bg="#eef4ff").pack(pady=(0, 10))
        self.status.config(text=f"Graph saved as {output_file}")


if __name__ == "__main__":
    root = tk.Tk()
    app = StudentManagerApp(root)
    root.mainloop()

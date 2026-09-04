import importlib.util
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("codex_queue.py")
SPEC = importlib.util.spec_from_file_location("codex_queue", MODULE_PATH)
queue = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(queue)


class QueueMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db = self.root / "queue.sqlite"
        self.previous_accounts = os.environ.get("CODEX_QUEUE_ACCOUNTS_ROOT")
        self.previous_projects = os.environ.get("CODEX_QUEUE_PROJECTS_ROOT")
        os.environ["CODEX_QUEUE_ACCOUNTS_ROOT"] = str(self.root / "accounts")
        os.environ["CODEX_QUEUE_PROJECTS_ROOT"] = str(self.root / "projects")

    def tearDown(self):
        self.temp.cleanup()
        if self.previous_accounts is None:
            os.environ.pop("CODEX_QUEUE_ACCOUNTS_ROOT", None)
        else:
            os.environ["CODEX_QUEUE_ACCOUNTS_ROOT"] = self.previous_accounts
        if self.previous_projects is None:
            os.environ.pop("CODEX_QUEUE_PROJECTS_ROOT", None)
        else:
            os.environ["CODEX_QUEUE_PROJECTS_ROOT"] = self.previous_projects

    def test_fresh_database_seeds_primary_account_and_projects(self):
        with queue.connect(str(self.db)) as connection:
            account = connection.execute("SELECT * FROM accounts WHERE slug='primary'").fetchone()
            projects = connection.execute("SELECT slug FROM projects ORDER BY slug").fetchall()
            columns = {row[1] for row in connection.execute("PRAGMA table_info(jobs)")}
        self.assertEqual(account["auth_state"], "pending")
        self.assertEqual([row[0] for row in projects], ["butler", "familyos"])
        self.assertIn("account_id", columns)

    def test_old_jobs_are_migrated_to_primary_account(self):
        connection = sqlite3.connect(self.db)
        try:
            connection.execute(
                "CREATE TABLE jobs(id INTEGER PRIMARY KEY,title TEXT,prompt TEXT,repo_path TEXT,session_id TEXT,"
                "schedule_mode TEXT,interval_minutes INTEGER,next_run_at INTEGER,enabled INTEGER,status TEXT,"
                "retry_count INTEGER,last_run_at INTEGER,last_exit_code INTEGER,last_output TEXT,last_thread_id TEXT,"
                "created_at INTEGER,updated_at INTEGER)"
            )
            connection.execute(
                "INSERT INTO jobs VALUES(1,'旧任务','继续','/tmp/repo',NULL,'once',300,1,1,'scheduled',0,NULL,NULL,NULL,NULL,1,1)"
            )
            connection.commit()
        finally:
            connection.close()
        with queue.connect(str(self.db)) as connection:
            primary = connection.execute("SELECT id FROM accounts WHERE slug='primary'").fetchone()[0]
            account_id = connection.execute("SELECT account_id FROM jobs WHERE id=1").fetchone()[0]
        self.assertEqual(account_id, primary)

    def test_account_ready_requires_local_auth_file(self):
        queue.account_init(str(self.db), "client-one", "客户一")
        with self.assertRaisesRegex(ValueError, "auth.json"):
            queue.account_mark_ready(str(self.db), "client-one")
        auth_file = queue.account_home("client-one") / "auth.json"
        auth_file.write_text("{" + "x" * 120 + "}", encoding="utf-8")
        queue.account_mark_ready(str(self.db), "client-one")
        with queue.connect(str(self.db)) as connection:
            state = connection.execute("SELECT auth_state FROM accounts WHERE slug='client-one'").fetchone()[0]
        self.assertEqual(state, "ready")

    def test_logs_redact_credentials_and_api_rows_hide_server_path(self):
        redacted = queue.redact_sensitive(
            "password=hunter2 authorization: Bearer abcdef api_key=secret-value "
            "sk-abcdefghijklmnopqrstuvwxyz"
        )
        self.assertNotIn("hunter2", redacted)
        self.assertNotIn("abcdef", redacted)
        self.assertNotIn("secret-value", redacted)
        self.assertNotIn("sk-abcdefghijklmnopqrstuvwxyz", redacted)

        with queue.connect(str(self.db)) as connection:
            primary = connection.execute("SELECT id FROM accounts WHERE slug='primary'").fetchone()[0]
            connection.execute(
                "INSERT INTO jobs(title,prompt,repo_path,next_run_at,created_at,updated_at,account_id) "
                "VALUES('t','p','/private/server/path',1,1,1,?)",
                (primary,),
            )
            row = queue.list_jobs(connection, "WHERE jobs.title='t'")[0]
        self.assertNotIn("repo_path", queue.row_dict(row))


if __name__ == "__main__":
    unittest.main()

# -*- coding: utf-8 -*-
"""매일 아침 자동 확인 켜기·끄기. 실제 예약 작업은 만들지 않는다 (명령 실행과 홈 폴더를 가짜로 바꿔서 확인)."""
import plistlib
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from amoread.ai import api, autostart


class Mac(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.calls = []

        def fake(*cmd, timeout=40):
            self.calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, "", "")
        self.ps = [mock.patch.object(autostart, "_plist", return_value=Path(self.tmp.name) / "a.plist"), mock.patch.object(autostart, "_sh", side_effect=fake),
                   mock.patch.object(autostart.sys, "platform", "darwin"), mock.patch.object(autostart.os, "name", "posix")]
        for p in self.ps:
            p.start()

    def tearDown(self):
        for p in self.ps:
            p.stop()
        self.tmp.cleanup()

    def test_enable_writes_schedule_and_status_reads_it_back(self):
        r = autostart.enable("07:45")
        self.assertTrue(r["ok"], r)
        d = plistlib.loads(autostart._plist().read_bytes())
        self.assertEqual(d["StartCalendarInterval"], {"Hour": 7, "Minute": 45})
        self.assertEqual(d["ProgramArguments"][1:], ["-m", "amoread.ai.daily"])
        self.assertTrue(d["RunAtLoad"], "그 시각에 꺼져 있던 날은 로그인할 때 돌아야 해요")
        self.assertTrue(r["on"]); self.assertEqual(r["at"], "07:45")
        self.assertIn("bootstrap", [c[1] for c in self.calls])

    def test_disable_removes_it(self):
        autostart.enable("09:30")
        r = autostart.disable()
        self.assertTrue(r["ok"]); self.assertFalse(r["on"])
        self.assertFalse(autostart._plist().exists())

    def test_failed_registration_leaves_nothing_behind(self):
        def fail(*cmd, timeout=40):
            return subprocess.CompletedProcess(cmd, 1 if cmd[1] == "bootstrap" else 0, "", "Bootstrap failed")
        with mock.patch.object(autostart, "_sh", side_effect=fail):
            r = autostart.enable("09:30")
        self.assertFalse(r["ok"]); self.assertFalse(autostart._plist().exists())


class Common(unittest.TestCase):
    def test_time_is_checked(self):
        for bad in ["9:30", "25:00", "09:60", "", "오전 9시", "09:30; rm -rf"]:
            self.assertFalse(autostart.valid_time(bad), bad)
            self.assertFalse(autostart.enable(bad)["ok"])
        self.assertTrue(autostart.valid_time("09:30"))
        with self.assertRaises(Exception):
            api.AutoReq(on=True, at="9시")

    def test_windows_uses_the_one_registration_script(self):
        calls = []

        def fake(*cmd, timeout=40):
            calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, "", "")
        with mock.patch.object(autostart.os, "name", "nt"), mock.patch.object(autostart, "_sh", side_effect=fake), mock.patch.object(autostart, "_python", return_value=mock.Mock(exists=lambda: True)), mock.patch.object(autostart, "status", return_value={"on": True, "at": "08:00"}):
            self.assertTrue(autostart.enable("08:00")["ok"])
        cmd = next(c for c in calls if c[0] == "powershell")
        self.assertTrue(str(cmd[cmd.index("-File") + 1]).endswith("register_daily.ps1"))
        self.assertEqual(cmd[-2:], ("-At", "08:00"))
        self.assertTrue((autostart.ROOT / "register_daily.ps1").exists())

    def test_run_now_does_not_start_twice(self):
        started = []
        no_lock = mock.Mock(exists=lambda: False)   # 이 PC에서 실제 자동 확인이 돌고 있어도(잠금 파일) 시험 결과가 바뀌지 않게
        with mock.patch.object(autostart.daily, "run", side_effect=lambda force=False: started.append(1)), mock.patch.object(autostart.threading, "Thread") as th, \
                mock.patch.object(autostart.daily, "_lock_path", return_value=no_lock):
            autostart._running["on"] = False
            a = autostart.run_now(); b = autostart.run_now()
            autostart._running["on"] = False
        self.assertEqual(th.call_count, 1)
        self.assertTrue(b.get("already"))


if __name__ == "__main__":
    unittest.main()

import unittest

from video import FPS, FRAME_COUNT, SCENES, font, scene_at, validate_layout, validate_timeline


class TimelineTests(unittest.TestCase):
    def test_complete_minute_with_expected_story_beats(self):
        validate_timeline(SCENES)
        self.assertEqual(FRAME_COUNT, 60 * FPS)
        expected = [(0, "title"), (7, "idea"), (18, "create"),
                    (28, "practice"), (40, "tournament"), (51, "invite")]
        for seconds, name in expected:
            scene, progress = scene_at(seconds * FPS)
            self.assertEqual(scene.name, name)
            self.assertEqual(progress, 0)
        for frame in range(FRAME_COUNT):
            scene, progress = scene_at(frame)
            self.assertTrue(scene.start <= frame < scene.end)
            self.assertTrue(0 <= progress < 1)

    def test_boundaries_and_invalid_frames(self):
        for previous, current in zip(SCENES, SCENES[1:]):
            self.assertEqual(scene_at(current.start - 1)[0], previous)
            self.assertEqual(scene_at(current.start)[0], current)
        for frame in (-1, FRAME_COUNT, 1.5):
            with self.assertRaises(ValueError):
                scene_at(frame)

    def test_rejects_a_missing_scene(self):
        with self.assertRaises(ValueError):
            validate_timeline(SCENES[:2] + SCENES[3:])


class RenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from video import Assets
        cls.assets = Assets()

    def test_all_scenes_render_and_move_deterministically(self):
        from PIL import ImageChops
        from video import render_frame
        for scene in SCENES:
            frame = scene.start + (30 if scene.name == "idea" else 60)
            first = render_frame(frame, self.assets)
            with self.subTest(scene=scene.name):
                self.assertEqual(first.size, (1920, 1080))
                self.assertEqual(first.mode, "RGB")
                self.assertIsNone(ImageChops.difference(first, render_frame(frame, self.assets)).getbbox())
                self.assertIsNotNone(ImageChops.difference(first, render_frame(frame + 12, self.assets)).getbbox())

    def test_transitions_and_loop_have_valid_frames(self):
        from PIL import ImageChops
        from video import render_frame
        for scene in SCENES[1:]:
            for offset in (0, 7, 15):
                self.assertEqual(render_frame(scene.start + offset, self.assets).size, (1920, 1080))
        first = render_frame(0, self.assets)
        last = render_frame(FRAME_COUNT - 1, self.assets)
        self.assertIsNone(ImageChops.difference(first, last).getbbox())

    def test_missing_or_malformed_sprite_fails_early(self):
        import tempfile
        from pathlib import Path
        from PIL import Image
        from video import load_sheet
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sprite.png"
            with self.assertRaises(FileNotFoundError):
                load_sheet(path, 32)
            Image.new("RGBA", (35, 32)).save(path)
            with self.assertRaisesRegex(ValueError, "sprite"):
                load_sheet(path, 32)

    def test_transition_never_superimposes_two_headlines(self):
        from PIL import Image, ImageChops
        from video import transition
        outgoing = Image.new("RGB", (8, 8), "red")
        incoming = Image.new("RGB", (8, 8), "blue")
        background = Image.new("RGB", (8, 8), "black")
        self.assertIsNone(ImageChops.difference(transition(outgoing, incoming, background, 0.5), background).getbbox())
        for step in range(21):
            pixel = transition(outgoing, incoming, background, step / 20).getpixel((0, 0))
            self.assertFalse(pixel[0] > 0 and pixel[2] > 0)


class ExportTests(unittest.TestCase):
    def test_real_encode_decode_properties_and_frame_count(self):
        import subprocess
        import tempfile
        from pathlib import Path
        from PIL import Image
        import imageio_ffmpeg
        from video import export_video, verify_video
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.mp4"
            frames = (Image.new("RGB", (1920, 1080), color) for color in ("red", "green", "blue"))
            export_video(path, frames, 3)
            metadata = verify_video(path, 3)
            self.assertEqual(metadata["size"], (1920, 1080))
            self.assertEqual(metadata["fps"], 30)
            self.assertEqual(metadata["codec"], "h264")
            self.assertIn("yuv420p", metadata["pix_fmt"])
            decoded = subprocess.run(
                [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path),
                 "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
                capture_output=True, check=True,
            ).stdout
            frame_bytes = 1920 * 1080 * 3
            self.assertEqual(len(decoded), 3 * frame_bytes)
            self.assertGreater(decoded[0], 240)
            self.assertGreater(decoded[2 * frame_bytes + 2], 240)

    def test_encoder_and_frame_errors_preserve_existing_output(self):
        import tempfile
        from pathlib import Path
        from PIL import Image
        from video import export_video
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "existing.mp4"
            path.write_bytes(b"previous-video")
            with self.assertRaises(Exception):
                export_video(path, [Image.new("RGB", (1920, 1080))], 1, codec="not_a_codec")
            self.assertEqual(path.read_bytes(), b"previous-video")
            with self.assertRaisesRegex(ValueError, "frame count"):
                export_video(path, [], 1)
            self.assertEqual(path.read_bytes(), b"previous-video")
            self.assertEqual(list(Path(directory).iterdir()), [path])


class LayoutTests(unittest.TestCase):
    def test_real_font_and_all_copy_fit_safe_area(self):
        boxes = validate_layout()
        self.assertGreater(len(boxes), 12)
        for name, (left, top, right, bottom) in boxes:
            with self.subTest(name=name):
                self.assertGreaterEqual(left, 96)
                self.assertLessEqual(right, 1824)
                self.assertGreaterEqual(top, 96)
                self.assertLessEqual(bottom, 984)
        self.assertGreater(font(48).getlength("Früchte – möglichst"), 0)

    def test_text_overflow_is_not_silently_clipped(self):
        from video import TextBlock
        with self.assertRaisesRegex(ValueError, "overflow"):
            validate_layout([TextBlock("overflow", "W" * 100, 96, 200, 90, "white")])


if __name__ == "__main__":
    unittest.main()

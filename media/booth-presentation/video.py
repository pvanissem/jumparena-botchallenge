"""Deterministic, offline motion graphics for the Coin Quest Arena booth."""

from dataclasses import dataclass
from functools import lru_cache
import argparse
import math
from pathlib import Path
import subprocess
import tempfile

import imageio_ffmpeg

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GAME_ASSETS = ROOT.parents[1] / "client" / "public" / "assets"
WIDTH, HEIGHT, FPS = 1920, 1080, 30
FRAME_COUNT = 60 * FPS
INK, MUTED = "#e8e8ff", "#a4aecb"
CYAN, PINK, YELLOW, GREEN = "#38e8ff", "#ff4fa3", "#ffd23f", "#57ff8f"
COLORS = (CYAN, GREEN, PINK, YELLOW)


@dataclass(frozen=True)
class Scene:
    name: str
    start: int
    end: int


SCENES = (
    Scene("title", 0, 7 * FPS),
    Scene("idea", 7 * FPS, 18 * FPS),
    Scene("create", 18 * FPS, 28 * FPS),
    Scene("practice", 28 * FPS, 40 * FPS),
    Scene("tournament", 40 * FPS, 51 * FPS),
    Scene("invite", 51 * FPS, FRAME_COUNT),
)


@dataclass(frozen=True)
class TextBlock:
    name: str
    text: str
    x: int
    y: int
    size: int
    color: str
    weight: int = 650


BRAND = TextBlock("brand", "COIN QUEST ARENA", 144, 102, 32, INK, 700)
FOOTER = TextBlock("footer", "MIT DEINER IDEE INS SPIEL", 112, 946, 24, MUTED, 500)
COPY = {
    "title": (
        TextBlock("title-1", "Deine Strategie.", 112, 268, 100, INK),
        TextBlock("title-2", "Dein Bot.", 112, 386, 100, CYAN),
        TextBlock("title-3", "Dein Rennen.", 112, 504, 100, INK),
    ),
    "idea": (TextBlock("idea-title", "Beschreib deine Idee.", 112, 222, 96, INK),),
    "create": (
        TextBlock("create-title", "devkcode macht daraus deinen Bot.", 112, 222, 86, INK),
        TextBlock("create-subtitle", "Keine Programmierkenntnisse nötig", 112, 346, 46, CYAN, 500),
    ),
    "practice": (
        TextBlock("practice-title", "Ausprobieren. Verbessern.", 112, 214, 88, INK),
        TextBlock("practice-title-2", "Loslegen.", 112, 314, 88, CYAN),
    ),
    "tournament": (
        TextBlock("tournament-title", "Dein Bot tritt im Turnier an.", 112, 222, 92, INK),
    ),
    "invite": (
        TextBlock("invite-title", "Welche Strategie gewinnt?", 112, 222, 98, INK),
        TextBlock("invite-subtitle", "Bau deinen Bot – hier am Stand.", 112, 354, 58, CYAN),
    ),
}
PROMPT = (
    TextBlock("prompt-1", "Sammle viele Früchte und", 220, 573, 62, INK, 500),
    TextBlock("prompt-2", "geh möglichst wenig Risiko ein.", 220, 657, 62, INK, 500),
)
ILLUSTRATION = TextBlock("illustration", "SPIELILLUSTRATION", 1470, 946, 24, MUTED, 500)


@lru_cache(maxsize=None)
def font(size, weight=650):
    path = ROOT / "assets" / "Outfit.ttf"
    if not path.is_file():
        raise FileNotFoundError(path)
    result = ImageFont.truetype(str(path), size)
    result.set_variation_by_axes([weight])
    return result


def validate_timeline(scenes):
    cursor = 0
    for scene in scenes:
        if scene.start != cursor or scene.end <= scene.start:
            raise ValueError(f"Invalid timeline at {scene.name}")
        cursor = scene.end
    if cursor != FRAME_COUNT:
        raise ValueError("Timeline must fill exactly 60 seconds")


def scene_at(frame):
    if not isinstance(frame, int) or not 0 <= frame < FRAME_COUNT:
        raise ValueError(f"Invalid frame: {frame}")
    for scene in SCENES:
        if scene.start <= frame < scene.end:
            return scene, (frame - scene.start) / (scene.end - scene.start)
    raise ValueError("Frame is outside the timeline")


def validate_layout(blocks=None):
    if blocks is None:
        blocks = [BRAND, FOOTER, ILLUSTRATION, *PROMPT]
        blocks.extend(block for scene in COPY.values() for block in scene)
    boxes = []
    for block in blocks:
        bounds = font(block.size, block.weight).getbbox(block.text, anchor="lt")
        left, top, right, bottom = (
            block.x + bounds[0], block.y + bounds[1],
            block.x + bounds[2], block.y + bounds[3],
        )
        if left < 96 or top < 96 or right > WIDTH - 96 or bottom > HEIGHT - 96:
            raise ValueError(f"Text overflow: {block.name}: {(left, top, right, bottom)}")
        boxes.append((block.name, (left, top, right, bottom)))
    return boxes


def load_sheet(path, cell):
    with Image.open(path) as source:
        sheet = source.convert("RGBA")
    if sheet.height != cell or sheet.width % cell:
        raise ValueError(f"Invalid sprite geometry: {path}: {sheet.size}")
    return tuple(sheet.crop((x, 0, x + cell, cell)) for x in range(0, sheet.width, cell))


def text(image, block, value=None):
    ImageDraw.Draw(image).text(
        (block.x, block.y), block.text if value is None else value,
        font=font(block.size, block.weight), fill=block.color, anchor="lt",
    )


def smooth(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


class Assets:
    def __init__(self):
        validate_timeline(SCENES)
        validate_layout()
        characters = ("Dudes/Virtual Guy", "Dudes/Ninja Frog", "Dudes/Pink Man", "Main Characters/Mask Dude")
        self.sheets = {}
        for index, character in enumerate(characters):
            for action in ("Run", "Idle", "Jump"):
                self.sheets[(index, action)] = load_sheet(
                    GAME_ASSETS / character / f"{action} (32x32).png", 32,
                )
        for fruit in ("Apple", "Bananas", "Cherries", "Kiwi"):
            self.sheets[fruit] = load_sheet(GAME_ASSETS / "Items" / "Fruits" / f"{fruit}.png", 32)
        with Image.open(GAME_ASSETS / "Terrain" / "Terrain (16x16).png") as source:
            self.terrain = source.convert("RGBA")
        self.scaled = {}
        self.background = self.make_background()
        self.stages = {scene.name: self.make_stage(scene.name) for scene in SCENES}
        self.levels = {}

    def sprite(self, image, key, x, y, scale, tick):
        frames = self.sheets[key]
        index = int(tick * 10) % len(frames)
        cache_key = (key, scale, index)
        if cache_key not in self.scaled:
            self.scaled[cache_key] = frames[index].resize((32 * scale, 32 * scale), Image.Resampling.NEAREST)
        sprite = self.scaled[cache_key]
        image.paste(sprite, (round(x), round(y)), sprite)

    def make_background(self):
        image = Image.new("RGB", (WIDTH, HEIGHT))
        draw = ImageDraw.Draw(image)
        for y in range(HEIGHT):
            p = y / HEIGHT
            draw.line((0, y, WIDTH, y), fill=(int(15 - 6 * p), int(23 - 9 * p), int(45 - 17 * p)))
        for x in range(0, WIDTH, 64):
            draw.line((x, 0, x, HEIGHT), fill="#182237")
        for y in range(0, HEIGHT, 64):
            draw.line((0, y, WIDTH, y), fill="#182237")
        draw.polygon([(1250, 0), (1920, 0), (1920, 650)], fill="#102e40")
        draw.polygon([(0, 790), (440, 1080), (0, 1080)], fill="#1d213e")
        draw.line((112, 169, 1808, 169), fill="#35415b", width=2)
        draw.line((112, 909, 1808, 909), fill="#35415b", width=2)
        draw.rectangle((112, 104, 129, 121), fill=CYAN)
        text(image, BRAND)
        text(image, FOOTER)
        # Small geometric brand mark, not another line of copy.
        for i, color in enumerate(COLORS):
            draw.rectangle((1720 + i * 24, 105, 1732 + i * 24, 117), fill=color)
        return image

    def make_stage(self, name):
        image = self.background.copy()
        for block in COPY[name]:
            text(image, block)
        if name in ("practice", "tournament"):
            text(image, ILLUSTRATION)
        draw = ImageDraw.Draw(image)
        if name == "title":
            draw.rectangle((114, 669, 197, 677), fill=CYAN)
            draw.rectangle((211, 669, 294, 677), fill=PINK)
            draw.rectangle((308, 669, 391, 677), fill=YELLOW)
            draw.ellipse((1010, 247, 1770, 1007), outline="#244d61", width=2)
            draw.ellipse((1050, 287, 1730, 967), outline="#244d61", width=2)
        elif name == "idea":
            draw.rectangle((128, 426, 1808, 842), fill="#050c18")
            draw.rectangle((112, 410, 1792, 826), fill="#152640", outline="#39627b", width=3)
            draw.rectangle((112, 410, 1792, 486), fill="#203651")
            for i, color in enumerate(COLORS[:3]):
                draw.rectangle((144 + i * 30, 438, 157 + i * 30, 451), fill=color)
            draw.line((165, 578, 185, 598, 165, 618), fill=CYAN, width=5)
        elif name == "create":
            draw.rectangle((112, 478, 736, 814), fill="#152640", outline="#39627b", width=3)
            for i, width in enumerate((420, 330, 380)):
                draw.rectangle((176, 566 + 54 * i, 176 + width, 582 + 54 * i), fill=(CYAN, "#3e6078", "#3e6078")[i])
            draw.rectangle((1216, 462, 1760, 830), fill="#172c42", outline=CYAN, width=3)
            draw.rectangle((1216, 462, 1760, 475), fill=CYAN)
        return image

    def level_background(self, width, height, index):
        key = (width, height, index)
        if key in self.levels:
            return self.levels[key].copy()
        image = Image.new("RGB", (width, height), "#132a40")
        draw = ImageDraw.Draw(image)
        ground = height - 64
        for x in range(-80, width, 150):
            hill = 70 + ((x + 80) // 150 % 3) * 28
            draw.rectangle((x, ground - hill, x + 118, ground), fill="#1d3b4e")
            draw.rectangle((x + 26, ground - hill - 24, x + 92, ground), fill="#1d3b4e")
        for x in range(60, width, 310):
            draw.rectangle((x, 32, x + 54, 36), fill="#416277")
            draw.rectangle((x + 26, 23, x + 30, 46), fill="#416277")
        tile = self.terrain.crop((112, 0, 128, 16)).resize((64, 64), Image.Resampling.NEAREST)
        for x in range(0, width, 64):
            image.paste(tile, (x, ground), tile)
        obstacle_x = int(width * 0.56)
        box = self.terrain.crop((112, 16, 128, 32)).resize((48, 48), Image.Resampling.NEAREST)
        image.paste(box, (obstacle_x, ground - 48), box)
        draw.rectangle((obstacle_x, ground - 48, obstacle_x + 47, ground - 43), fill=COLORS[index])
        # Finish flag: an illustration, without an invented winner or score.
        draw.rectangle((width - 92, ground - 106, width - 87, ground), fill=INK)
        draw.polygon([(width - 86, ground - 106), (width - 40, ground - 90), (width - 86, ground - 74)], fill=COLORS[index])
        draw.rectangle((0, 0, width - 1, height - 1), outline="#416277", width=2)
        draw.rectangle((0, 0, width - 1, 5), fill=COLORS[index])
        self.levels[key] = image
        return image.copy()


def hero_group(image, assets, seconds, invite=False):
    draw = ImageDraw.Draw(image)
    if invite:
        positions = [(310 + i * 350, 598, 6) for i in range(4)]
    else:
        positions = [(1080, 364, 7), (1422, 342, 7), (1130, 655, 6), (1440, 655, 6)]
    for index, (x, y, scale) in enumerate(positions):
        size = scale * 32
        bob = round(math.sin(seconds * 1.7 + index * 1.1) * 9)
        draw.rectangle((x - 16, y + size - 6, x + size + 16, y + size + 12), fill="#070e1e")
        draw.rectangle((x - 16, y + size - 6, x + size + 16, y + size - 1), fill=COLORS[index])
        assets.sprite(image, (index, "Idle"), x, y + bob, scale, seconds)
        # A few pixel sparks give the otherwise quiet hero image movement.
        spark_y = y + 30 + int(math.sin(seconds + index) * 14)
        draw.rectangle((x + size + 12, spark_y, x + size + 20, spark_y + 8), fill=COLORS[index])


def running_level(assets, width, height, index, seconds):
    image = assets.level_background(width, height, index)
    ground = height - 64
    scale = 4 if height > 300 else 2
    size = 32 * scale
    # A repeated illustrative route, offset per bot; no simulation claims.
    phase = (seconds / (7.8 + index * 0.35) + index * 0.15) % 1
    x = 20 + phase * (width - size - 48)
    center = x + size / 2
    obstacle = width * 0.56 + 24
    jump_width = 165 if scale == 4 else 92
    delta = abs(center - obstacle)
    jump = (130 if scale == 4 else 96) * math.cos(delta / jump_width * math.pi / 2) if delta < jump_width else 0
    draw = ImageDraw.Draw(image)
    draw.ellipse((x + size * 0.2, ground - 12, x + size * 0.8, ground - 2), fill="#081924")
    for item in range(4):
        fruit_x = 90 + (width - 220) * item / 4
        if fruit_x > center + 6:
            fruit_y = ground - (125 if scale == 4 else 88) + math.sin(seconds * 2 + item) * 5
            assets.sprite(image, ("Apple", "Bananas", "Cherries", "Kiwi")[item], fruit_x, fruit_y, 2 if scale == 4 else 1, seconds)
    assets.sprite(image, (index, "Jump" if jump > 10 else "Run"), x, ground - size - jump + scale * 2, scale, seconds)
    return image


def render_scene(scene, frame, assets):
    seconds = (frame - scene.start) / FPS
    image = assets.stages[scene.name].copy()
    draw = ImageDraw.Draw(image)
    if scene.name == "title":
        hero_group(image, assets, seconds)
    elif scene.name == "idea":
        characters = int(max(0, seconds - 0.5) * 38)
        for block in PROMPT:
            text(image, block, block.text[:characters])
            characters = max(0, characters - len(block.text))
        draw.rectangle((1638, 701, 1726, 773), fill=CYAN)
        draw.line((1696, 723, 1696, 747, 1661, 747), fill="#102335", width=5)
        draw.line((1670, 738, 1661, 747, 1670, 756), fill="#102335", width=5)
    elif scene.name == "create":
        for i in range(3):
            x = 840 + i * 105
            offset = int(math.sin(seconds * 2 - i * 0.6) * 8)
            draw.line((x, 618 + offset, x + 28, 646 + offset, x, 674 + offset), fill=CYAN, width=6)
        assets.sprite(image, (0, "Idle"), 1344, 525 + 8 * math.sin(seconds * 2), 9, seconds)
        reveal = smooth(seconds / 1.2)
        if reveal < 1:
            image = Image.blend(assets.stages[scene.name], image, reveal)
    elif scene.name == "practice":
        image.paste(running_level(assets, 1696, 412, 0, seconds), (112, 464))
    elif scene.name == "tournament":
        for i in range(4):
            x, y = 112 + (i % 2) * 872, 371 + (i // 2) * 264
            image.paste(running_level(assets, 824, 240, i, seconds), (x, y))
    elif scene.name == "invite":
        hero_group(image, assets, seconds, invite=True)
    return image


def transition(outgoing, incoming, background, progress):
    # Fade through the shared stage instead of stacking two unreadable headlines.
    if progress < 0.5:
        return Image.blend(outgoing, background, smooth(progress * 2))
    return Image.blend(background, incoming, smooth((progress - 0.5) * 2))


def render_frame(frame, assets):
    scene, _ = scene_at(frame)
    image = render_scene(scene, frame, assets)
    elapsed = frame - scene.start
    if scene.start and elapsed < 15:
        previous = SCENES[SCENES.index(scene) - 1]
        outgoing = render_scene(previous, scene.start - 1, assets)
        image = transition(outgoing, image, assets.background, elapsed / 15)
    if frame >= FRAME_COUNT - FPS:
        first = render_scene(SCENES[0], 0, assets)
        image = transition(image, first, assets.background, (frame - (FRAME_COUNT - FPS)) / (FPS - 1))
    return image


def verify_video(path, expected_frames):
    reader = imageio_ffmpeg.read_frames(str(path))
    try:
        metadata = next(reader)
    finally:
        reader.close()
    if (metadata["size"] != (WIDTH, HEIGHT) or metadata["fps"] != FPS
            or metadata["codec"] != "h264" or "yuv420p" not in metadata["pix_fmt"]):
        raise ValueError(f"Unexpected video format: {metadata}")
    result = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-xerror", "-i", str(path),
         "-map", "0:v:0", "-f", "null", "-", "-progress", "pipe:1", "-nostats"],
        capture_output=True, text=True, check=True,
    )
    counts = [int(line.split("=", 1)[1]) for line in result.stdout.splitlines() if line.startswith("frame=")]
    if not counts or counts[-1] != expected_frames:
        raise ValueError(f"Unexpected decoded frame count: {counts}")
    if abs(metadata["duration"] - expected_frames / FPS) > 0.04:
        raise ValueError(f"Unexpected duration: {metadata['duration']}")
    return metadata


def export_video(path, frames, expected_frames, codec="libx264"):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".mp4", prefix=".render-", dir=path.parent, delete=False) as output:
        temporary = Path(output.name)
    process = None
    try:
        with tempfile.TemporaryFile() as errors:
            process = subprocess.Popen(
                [imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                 "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgb24",
                 "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0", "-an",
                 "-c:v", codec, "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
                 "-vf", "setsar=1", "-movflags", "+faststart", str(temporary)],
                stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=errors,
            )
            count = 0
            try:
                for image in frames:
                    if image.mode != "RGB" or image.size != (WIDTH, HEIGHT):
                        raise ValueError("Invalid frame format")
                    process.stdin.write(image.tobytes())
                    count += 1
                if count != expected_frames:
                    raise ValueError(f"Unexpected frame count: {count}, expected {expected_frames}")
                process.stdin.close()
                status = process.wait(timeout=120)
                if status:
                    errors.seek(0)
                    raise RuntimeError(errors.read().decode(errors="replace"))
            except BrokenPipeError as exc:
                process.wait(timeout=30)
                errors.seek(0)
                raise RuntimeError(errors.read().decode(errors="replace")) from exc
        verify_video(temporary, expected_frames)
        temporary.replace(path)
    finally:
        if process is not None:
            if process.poll() is None:
                process.kill()
                process.wait()
            if process.stdin and not process.stdin.closed:
                try:
                    process.stdin.close()
                except BrokenPipeError:
                    pass
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "coin-quest-arena.mp4")
    parser.add_argument("--still", type=int, help="Render one frame index as a PNG")
    parser.add_argument("--start", type=int, default=0, help="First frame for a short preview")
    parser.add_argument("--frames", type=int, default=FRAME_COUNT)
    parser.add_argument("--verify", action="store_true", help="Decode and verify the existing output")
    args = parser.parse_args()
    if args.frames < 1 or args.start < 0 or args.start + args.frames > FRAME_COUNT:
        parser.error("Preview range must be within frames 0–1799")
    if args.verify:
        print(verify_video(args.output, args.frames))
        return
    assets = Assets()
    if args.still is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        render_frame(args.still, assets).save(args.output, format="PNG")
        return

    def frames():
        for index in range(args.start, args.start + args.frames):
            if (index - args.start) % 150 == 0:
                print(f"Render {index - args.start}/{args.frames}", flush=True)
            yield render_frame(index, assets)

    export_video(args.output, frames(), args.frames)
    print(f"Verified: {args.output} ({args.frames} frames, {args.frames / FPS:g} s)")


if __name__ == "__main__":
    main()

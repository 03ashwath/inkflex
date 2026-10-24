
import os
import shutil
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

# Google Drive file ID
FILE_ID = "19zZSjcPeM1RxahigYQ5-z-ZlTTSAKCis"

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent
IMAGE_DIR = PROJECT_ROOT / "ml" / "data" / "Tattoo_img_200"

# Temporary download location
ZIP_PATH = PROJECT_ROOT / "inkflex-images.zip"

def download_file():
    url = f"https://drive.usercontent.google.com/download?id={FILE_ID}&export=download&authuser=0&confirm=t"
    request = Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )

    with urlopen(request, timeout=180) as response:
        content_type = response.headers.get("Content-Type", "")
        data = response.read()

    # Detect Google Drive HTML confirmation/error pages
    if "text/html" in content_type.lower() or data[:20].lower().startswith(b"<!doctype html"):
        raise RuntimeError(
            "Google Drive returned a web page instead of the ZIP. "
            "Use a direct public download URL or asset hosting."
        )

    with open(ZIP_PATH, "wb") as file:
        file.write(data)

    if not zipfile.is_zipfile(ZIP_PATH):
        raise RuntimeError("Downloaded file is not a valid ZIP archive.")

def extract_images():
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(ZIP_PATH, "r") as archive:
        # Extract only image files, without allowing path traversal.
        for info in archive.infolist():
            if info.is_dir():
                continue

            name = Path(info.filename).name
            if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                continue

            if not name:
                continue

            destination = IMAGE_DIR / name

            with archive.open(info) as src, open(destination, "wb") as dst:
                shutil.copyfileobj(src, dst)

    images = list(IMAGE_DIR.glob("*"))
    print(f"Images available: {len(images)}")
    print(f"Image directory: {IMAGE_DIR}")

if __name__ == "__main__":
    download_file()
    extract_images()

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    print("Asset download complete.")

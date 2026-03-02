import os
import sys
import json
import base64
import lz4.frame as frame
import mimetypes

def pack_assets(input_dir: str, output_file: str):
    assets = {}

    for root, _, files in os.walk(input_dir):
        for fname in files:
            path = os.path.join(root, fname)
            rel_path = os.path.relpath(path, input_dir).replace("\\", "/")

            # Read file bytes
            with open(path, "rb") as f:
                data = f.read()

            # Compress with LZ4 (frame format)
            compressed = frame.compress(data)

            # Base64 encode
            b64 = base64.b64encode(compressed).decode("utf-8")

            # Guess MIME type
            mime, _ = mimetypes.guess_type(fname)
            if mime is None:
                mime = "application/octet-stream"

            assets[rel_path] = [b64, len(data), mime]

            print(
                f"Packed: {rel_path} ({len(data)} bytes → {len(compressed)} compressed)"
            )

    # Write JSON file
    with open(output_file, "w", encoding="utf-8") as out:
        json.dump(assets, out, indent=2)

    print(f"\nDone! Wrote {output_file} with {len(assets)} assets.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pack_assets.py <input_dir> <output.json>")
        sys.exit(1)

    pack_assets(sys.argv[1], sys.argv[2])

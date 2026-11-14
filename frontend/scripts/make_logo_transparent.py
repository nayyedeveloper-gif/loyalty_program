from PIL import Image

src = r"c:\Users\User\Desktop\29 Project\frontend\public\brand\29-logo.png"
img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        brightness = (r + g + b) / 3
        # Near-black solid background
        if brightness < 28 and max(r, g, b) < 40:
            pixels[x, y] = (0, 0, 0, 0)
        # Soft edge for anti-aliased black fringes
        elif brightness < 55 and max(abs(r - g), abs(g - b), abs(r - b)) < 18:
            alpha = int(max(0, min(255, (brightness - 28) * (255 / 27))))
            pixels[x, y] = (r, g, b, alpha)

img.save(src, "PNG")
print(f"saved {w}x{h} transparent logo")

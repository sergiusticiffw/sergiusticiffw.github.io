#!/usr/bin/env python3
"""
Generate a visual mockup of the modern expenses app UI
"""
from PIL import Image, ImageDraw, ImageFont
import math

# Create image
width, height = 800, 1400
img = Image.new('RGB', (width, height), color='#0f0f0f')
draw = ImageDraw.Draw(img)

# Colors
bg_dark = '#0f0f0f'
bg_medium = '#1a1a1a'
bg_light = '#151515'
primary_blue = '#5b8def'
primary_blue_dark = '#4a7ddc'
primary_blue_light = '#7ba3f5'
accent_purple = '#a78bfa'
white = '#ffffff'
glass_bg = (255, 255, 255, 20)  # rgba
glass_border = (255, 255, 255, 30)

def draw_gradient_background():
    """Draw gradient background"""
    for y in range(height):
        ratio = y / height
        r1, g1, b1 = 15, 15, 15  # #0f0f0f
        r2, g2, b2 = 26, 26, 26  # #1a1a1a
        r3, g3, b3 = 21, 21, 21  # #151515
        
        if ratio < 0.5:
            r = int(r1 + (r2 - r1) * (ratio * 2))
            g = int(g1 + (g2 - g1) * (ratio * 2))
            b = int(b1 + (b2 - b1) * (ratio * 2))
        else:
            r = int(r2 + (r3 - r2) * ((ratio - 0.5) * 2))
            g = int(g2 + (g3 - g2) * ((ratio - 0.5) * 2))
            b = int(b2 + (b3 - b2) * ((ratio - 0.5) * 2))
        
        draw.line([(0, y), (width, y)], fill=(r, g, b))

def draw_glass_card(x, y, w, h, radius=20):
    """Draw a glassmorphism card"""
    # Shadow
    shadow_offset = 4
    draw.rounded_rectangle(
        [x + shadow_offset, y + shadow_offset, x + w + shadow_offset, y + h + shadow_offset],
        radius=radius,
        fill=(0, 0, 0, 100)
    )
    
    # Card background with gradient
    for i in range(h):
        alpha = int(8 + (12 - 8) * (i / h))
        draw.rectangle(
            [x, y + i, x + w, y + i + 1],
            fill=(255, 255, 255, alpha)
        )
    
    # Border
    draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        outline=(255, 255, 255, 30),
        width=1
    )

def draw_stat_card(x, y, icon_text, value, label):
    """Draw a modern stat card"""
    card_w, card_h = 160, 120
    
    # Glass card
    draw_glass_card(x, y, card_w, card_h, radius=20)
    
    # Icon circle
    icon_x, icon_y = x + card_w // 2, y + 25
    icon_r = 26
    # Gradient circle background
    for i in range(icon_r):
        alpha = int(30 + (20 - 30) * (i / icon_r))
        draw.ellipse(
            [icon_x - icon_r + i, icon_y - icon_r + i, 
             icon_x + icon_r - i, icon_y + icon_r - i],
            outline=(91, 141, 239, alpha)
        )
    draw.ellipse(
        [icon_x - icon_r, icon_y - icon_r, icon_x + icon_r, icon_y + icon_r],
        fill=(91, 141, 239, 40),
        outline=(91, 141, 239, 100)
    )
    
    # Icon text (simplified)
    try:
        font_icon = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except:
        font_icon = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), icon_text, font=font_icon)
    text_w = bbox[2] - bbox[0]
    draw.text((icon_x - text_w // 2, icon_y - 12), icon_text, fill=primary_blue, font=font_icon)
    
    # Value
    try:
        font_value = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    except:
        font_value = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), value, font=font_value)
    text_w = bbox[2] - bbox[0]
    draw.text((x + card_w // 2 - text_w // 2, y + 60), value, fill=white, font=font_value)
    
    # Label
    try:
        font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        font_label = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), label, font=font_label)
    text_w = bbox[2] - bbox[0]
    draw.text((x + card_w // 2 - text_w // 2, y + 90), label, fill=(255, 255, 255, 165), font=font_label)

def draw_transaction_item(x, y, day, month, category, description, amount):
    """Draw a modern transaction list item"""
    item_w, item_h = width - 40, 80
    
    # Glass card
    draw_glass_card(x, y, item_w, item_h, radius=18)
    
    # Date box
    date_x, date_y = x + 15, y + 15
    date_w, date_h = 50, 50
    draw.rounded_rectangle(
        [date_x, date_y, date_x + date_w, date_y + date_h],
        radius=12,
        fill=(91, 141, 239, 30),
        outline=(91, 141, 239, 50)
    )
    
    # Day
    try:
        font_day = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    except:
        font_day = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), str(day), font=font_day)
    text_w = bbox[2] - bbox[0]
    draw.text((date_x + date_w // 2 - text_w // 2, date_y + 8), str(day), fill=white, font=font_day)
    
    # Month
    try:
        font_month = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    except:
        font_month = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), month, font=font_month)
    text_w = bbox[2] - bbox[0]
    draw.text((date_x + date_w // 2 - text_w // 2, date_y + 32), month, fill=(255, 255, 255, 128), font=font_month)
    
    # Category badge
    cat_x, cat_y = x + 80, y + 20
    cat_w, cat_h = 90, 40
    draw.rounded_rectangle(
        [cat_x, cat_y, cat_x + cat_w, cat_y + cat_h],
        radius=12,
        fill=(91, 141, 239, 40),
        outline=(91, 141, 239, 50)
    )
    try:
        font_cat = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
    except:
        font_cat = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), category, font=font_cat)
    text_w = min(bbox[2] - bbox[0], cat_w - 10)
    draw.text((cat_x + cat_w // 2 - text_w // 2, cat_y + cat_h // 2 - 8), category[:12], fill=(255, 255, 255, 215), font=font_cat)
    
    # Description
    desc_x, desc_y = x + 185, y + 20
    try:
        font_desc = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except:
        font_desc = ImageFont.load_default()
    draw.text((desc_x, desc_y), description[:25], fill=white, font=font_desc)
    
    # Amount
    amount_x = x + item_w - 100
    try:
        font_amount = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except:
        font_amount = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), amount, font=font_amount)
    text_w = bbox[2] - bbox[0]
    draw.text((amount_x + (100 - text_w) // 2, y + item_h // 2 - 10), amount, fill=white, font=font_amount)

def draw_navbar():
    """Draw modern navbar at bottom"""
    navbar_h = 70
    navbar_y = height - navbar_h
    
    # Glassmorphism navbar
    for y in range(navbar_h):
        alpha = int(190 + (200 - 190) * (y / navbar_h))
        draw.rectangle(
            [0, navbar_y + y, width, navbar_y + y + 1],
            fill=(15, 15, 15, alpha)
        )
    
    # Top border with gradient
    draw.line([(0, navbar_y), (width, navbar_y)], fill=(91, 141, 239, 80), width=1)
    
    # Nav items
    nav_items = ['🏠', '📊', '💰', '💳', '👤']
    item_w = width // len(nav_items)
    for i, icon in enumerate(nav_items):
        x = i * item_w + item_w // 2
        y = navbar_y + navbar_h // 2
        
        # Active indicator (first item)
        if i == 0:
            draw.ellipse(
                [x - 20, y - 20, x + 20, y + 20],
                fill=(91, 141, 239, 40),
                outline=(91, 141, 239, 100)
            )
        
        # Icon
        try:
            font_nav = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        except:
            font_nav = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), icon, font=font_nav)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        color = primary_blue if i == 0 else (255, 255, 255, 128)
        draw.text((x - text_w // 2, y - text_h // 2), icon, fill=color, font=font_nav)

# Draw the UI
draw_gradient_background()

# Title
try:
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
except:
    font_title = ImageFont.load_default()
title = "Expenses"
bbox = draw.textbbox((0, 0), title, font=font_title)
draw.text((width // 2 - (bbox[2] - bbox[0]) // 2, 40), title, fill=white, font=font_title)

# Stats Grid
y_start = 120
stat_cards = [
    ("💰", "1,234", "Total"),
    ("📊", "456", "Monthly"),
    ("📈", "789", "Average"),
    ("💵", "321", "Savings")
]

for i, (icon, value, label) in enumerate(stat_cards):
    x = 20 + (i % 2) * (width // 2 - 10)
    y = y_start + (i // 2) * 140
    draw_stat_card(x, y, icon, value, label)

# Transactions section title
try:
    font_section = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
except:
    font_section = ImageFont.load_default()
section_y = y_start + 300
draw.text((20, section_y), "Recent Transactions", fill=(255, 255, 255, 180), font=font_section)

# Transaction items
transactions = [
    (15, "DEC", "Food", "Grocery Shopping", "45.50"),
    (14, "DEC", "Transport", "Uber Ride", "12.30"),
    (13, "DEC", "Entertainment", "Movie Tickets", "25.00"),
    (12, "DEC", "Food", "Restaurant", "67.80"),
    (11, "DEC", "Shopping", "Clothing Store", "89.99"),
]

y_trans = section_y + 40
for i, (day, month, cat, desc, amount) in enumerate(transactions):
    draw_transaction_item(20, y_trans + i * 100, day, month, cat, desc, f"${amount}")

# Navbar
draw_navbar()

# Save image
output_path = '/workspace/expenses/public/ui-mockup-modern.png'
img.save(output_path, 'PNG')
print(f"✅ Imagine generată: {output_path}")

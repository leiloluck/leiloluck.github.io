# Quick Start Guide

## ✨ You're All Set!

Your Pig Game Track App now automatically loads audio files from folders!

## 🎯 Next Time You Want to Add a Sound:

### Option 1: Simple Command Line
```bash
# 1. Copy your new file
cp my_new_sound.mp3 "g:\My Drive\Math\website\marcelpadilla.github.io\Pig_Game\audio\sounds\"

# 2. Navigate and regenerate
cd "g:\My Drive\Math\website\marcelpadilla.github.io\Pig_Game"
python generate_audio_index.py

# 3. Commit
git add audio-files.json "audio/sounds/my_new_sound.mp3"
git commit -m "Add new sound"
git push
```

### Option 2: Windows Explorer
1. Drag and drop your `.mp3` file into the appropriate folder in `audio/`
2. Open PowerShell in the `Pig_Game` folder
3. Run: `python generate_audio_index.py`
4. Commit the changes with Git

## 📁 Folder Guide

Where to put your files:

- **`audio/start game/`** → Music for game start (looping background)
- **`audio/mid game/`** → Music for mid-game intensity (looping)
- **`audio/end game/`** → Music for final moments (looping)
- **`audio/victory/`** → Victory celebration music (looping)
- **`audio/sounds/`** → One-shot sound effects
- **`audio/more sounds/`** → Additional sound effects

## 🎨 What You Get Automatically

When you add a file, the script automatically:
- ✅ Picks an emoji icon based on the filename
- ✅ Assigns a rainbow color
- ✅ Creates a clean display name
- ✅ Adds it to the right section
- ✅ Wires up the click handler

## 🔍 Preview Before Pushing

Want to test locally before pushing to GitHub?

```bash
# Start local server
cd "g:\My Drive\Math\website\marcelpadilla.github.io\Pig_Game"
python -m http.server 8080

# Open browser to: http://localhost:8080
```

## 📝 File Naming Tips

Your filename becomes the button label:
- `Dramatic_Entry.mp3` → **Dramatic Entry**
- `big-explosion.mp3` → **big-explosion** 
- `ULTRAKILL.mp3` → **ULTRAKILL**

Pro tip: Use clear, descriptive names!

## 🐛 Something Not Working?

1. **Button doesn't appear?**
   - Did you run `python generate_audio_index.py`?
   - Check that your file is `.mp3` format
   - Look at the script output for errors

2. **Wrong icon?**
   - Open `generate_audio_index.py`
   - Find the `ICON_MAP` dictionary
   - Add your filename keyword → emoji mapping
   - Re-run the script

3. **Wrong color?**
   - Colors cycle automatically
   - To customize: edit `CATEGORIES` in the script

## 📚 Full Documentation

- **README.md** - Complete workflow and customization guide
- **IMPLEMENTATION.md** - Technical details and features
- **generate_audio_index.py** - The script (well commented!)

## 🎉 That's It!

You now have a fully automated sound board. Just drop files and run the script!

Enjoy! 🐖🐖

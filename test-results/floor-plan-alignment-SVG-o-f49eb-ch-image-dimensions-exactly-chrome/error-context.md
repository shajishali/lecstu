# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: floor-plan-alignment.spec.ts >> SVG overlay must match image dimensions exactly
- Location: tests\floor-plan-alignment.spec.ts:126:5

# Error details

```
Error: browserContext.newPage: Executable doesn't exist at C:\Users\Saji\AppData\Local\Temp\cursor-sandbox-cache\23e6ce5a44bbcba5c8d1f0aa467b70b2\playwright\ffmpeg-1011\ffmpeg-win64.exe
╔═════════════════════════════════════════════════════════════════╗
║ Video rendering requires ffmpeg binary.                         ║
║ Downloading it will not affect any of the system-wide settings. ║
║ Please run the following command:                               ║
║                                                                 ║
║     npx playwright install ffmpeg                               ║
║                                                                 ║
║ <3 Playwright Team                                              ║
╚═════════════════════════════════════════════════════════════════╝
```
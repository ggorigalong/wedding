# Animation Implementation Guide

## Important Rules for Animation System

### 1. Spreadsheet Animation Protection
When implementing new spreadsheet-based animations (like information, ending, hit-rabbit), you MUST protect them from being interrupted by other state changes:

```javascript
// In switchToState() where characters.forEach() is called:
if (id === 'information' && this.isInformationPlaying) {
    console.log(`🛡️ Protecting information animation from stopAnimation during state switch`);
    return; // Information 애니메이션 진행 중에는 보호
}
```

**Critical**: Never call `stopAnimation()` on a character that has an active spreadsheet animation running, as this will clear its `animationTimeout` and break the frame sequencing.

### 2. Animation State Flags
Always set proper state flags for active animations:
- `this.isInformationPlaying`
- `this.isEndingPlaying`
- `this.isHitRabbitPlaying`
- etc.

### 3. IMG Element Setup
For spreadsheet animations, always ensure the img element is properly set:
```javascript
if (!character.img) {
    character.img = character.element.querySelector('img');
}
```

### 4. Common Pitfall: State Switch Interference
**Problem**: When scroll stops or state changes occur during spreadsheet animations, the `switchToState()` function calls `stopAnimation()` on all characters, which clears the `animationTimeout` and breaks ongoing animations.

**Solution**: Add protection logic to exclude active spreadsheet animations from mass `stopAnimation()` calls.
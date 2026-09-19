# Implementation Summary: Custom SVG Icon Upload, Color Inheritance, and JSON Persistence

## Overview
Implemented a complete custom SVG icon system for habit tracking with the following features:
- Upload custom SVG icons with color inheritance (currentColor)
- Persist custom icons across sessions via JSON export/import
- Display custom icons alongside predefined Lucide icons in the icon picker

## Files Modified

### 1. `src/types/index.ts`
- Added `CustomIcon` interface:
  ```typescript
  export interface CustomIcon {
    id: string;
    svgContent: string;
  }
  ```

### 2. `src/database/repository.ts`
- Added `customIcons: CustomIcon[]` to `Snapshot` interface
- Imported `CustomIcon` type
- Updated `loadSnapshot()` to load `customIcons` from IndexedDB with backward compatibility
- Added `saveCustomIcons()` function for persistence:
  ```typescript
  export const saveCustomIcons = (customIcons: CustomIcon[]) => 
    put("meta", { id: "customIcons", customIcons });
  ```
- Updated `importSnapshot()` to include customIcons with backward compatibility fallback to `[]`

### 3. `src/stores/app-store.tsx`
- Added `customIcons: []` to initial state (`EMPTY`)
- Updated `exportData()` to include customIcons in JSON export:
  ```typescript
  customIcons: state.customIcons,
  ```
- Added two new actions in `actions` object:
  - `addCustomIcon(icon: { id: string; svgContent: string })` - Adds icon to state and persists
  - `removeCustomIcon(id: string)` - Removes icon by ID from state and persists
- Exposed `customIcons` in the store value with proper type checking

### 4. `src/features/habits/habit-form.tsx`
#### Imports
- Added `Upload` icon from lucide-react
- Added `CustomIcon` type import from `@/types`

#### State & Actions
- Extended `useApp()` destructuring to include:
  ```typescript
  const { ..., customIcons, addCustomIcon, removeCustomIcon } = useApp();
  ```

#### SVG Upload Handler
- Added `handleSvgUpload(e: React.ChangeEvent<HTMLInputElement>)` function:
  1. Validates file type (must be .svg)
  2. Uses `FileReader` to read SVG as text
  3. Sanitizes SVG for color inheritance:
     - Removes explicit `width` and `height` attributes
     - Replaces `fill="#..."` or `fill="black"` with `fill="currentColor"` (preserves `fill="none"`)
     - Replaces `stroke="#..."` with `stroke="currentColor"` (preserves `stroke="none"`)
     - Ensures `<svg>` tag has `width="100%"` and `height="100%"`
  4. Generates unique ID: `` `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` ``
  5. Calls `addCustomIcon()` to save to global state
  6. Sets form's selected icon to the new custom icon ID
  7. Shows success toast
  8. Resets file input for reuse

#### Icon Picker UI
- Replaced the icon fieldset with enhanced version:
  1. **Upload Button**: Dashed border button with `Upload` icon that triggers hidden file input
  2. **Hidden File Input**: `<input type="file" id="icon-upload" accept=".svg" className="hidden" onChange={handleSvgUpload} />`
  3. **Custom Icons Section**: Maps over `customIcons` array, renders each with:
     ```tsx
     <div 
       className="w-5 h-5 flex items-center justify-center text-current" 
       dangerouslySetInnerHTML={{ __html: customIcon.svgContent }} 
     />
     ```
     - Styled identically to Lucide icons
     - Highlights selected icon with primary border/background
  4. **Predefined Lucide Icons**: Existing icons rendered after custom icons

## Key Features Implemented

### Color Inheritance
- All uploaded SVGs have their colors replaced with `currentColor`, enabling them to inherit the habit's selected color
- Explicit `fill="none"` and `stroke="none"` are preserved to maintain transparency
- SVGs are normalized to 100% width/height for consistent sizing in the picker

### JSON Persistence
- Custom icons are included in `exportData()` JSON output
- `importSnapshot()` handles both new format (with customIcons) and legacy format (without customIcons fallback to `[]`)
- Automatic persistence via `saveCustomIcons()` on every add/remove

### Backward Compatibility
- All load/save operations check for array existence before accessing
- JSON import gracefully handles missing `customIcons` field
- Existing habits continue to work without modification

## Usage Flow
1. User clicks Upload button (dashed border with Upload icon) in icon picker
2. Hidden file input opens, user selects .svg file
3. SVG is read, sanitized, and saved to global customIcons state
4. New custom icon appears in the picker (before Lucide icons)
5. Custom icon is automatically selected for the current habit
6. Custom icons persist across sessions via JSON export/import
7. Custom icons can be reused across multiple habits

## Testing Notes
- Upload an SVG file (e.g., a simple shape with fill/stroke colors)
- Verify the SVG appears in the icon picker
- Verify the icon is selected and applied to the habit
- Export data to JSON and verify customIcons array is included
- Import the JSON into a fresh instance and verify customIcons are restored
- Verify color inheritance: the SVG should change color when the habit's color changes

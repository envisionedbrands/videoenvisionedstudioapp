# Design Guidelines: Envisioned Video Repurpose Portal

## Design Approach
**System-Based Approach**: Minimal, utility-focused application using clean modern design principles. This is a productivity tool where efficiency and clarity are paramount.

## Core Design Elements

### Typography
- **Primary Font**: Inter or SF Pro Display via Google Fonts CDN
- **Headings**: 
  - H1 (Page title): 32px (text-2xl), semi-bold (font-semibold)
  - Section labels: 14px (text-sm), medium weight, uppercase tracking
- **Body**: 16px (text-base), regular weight for inputs and descriptions
- **Button text**: 16px, medium weight

### Layout System
**Spacing Units**: Tailwind units of 4, 6, 8, 12, and 16
- Container: max-w-2xl, centered (mx-auto)
- Vertical spacing between sections: py-8 or py-12
- Form field spacing: gap-6
- Inner padding: p-6 or p-8
- Mobile padding: p-4

### Color Palette
- **Primary**: #000000 (buttons, text)
- **Secondary**: #e5d6c7 (accents, focus states, subtle backgrounds)
- **Background**: #ffffff
- **Text**: #000000 (primary), #666666 (secondary/hints)
- **Borders**: #e5e5e5 (light gray for inputs)
- **Success**: #22c55e
- **Error**: #ef4444

## Component Library

### Header
- Centered text "Envisioned Video Repurpose"
- Background: white with subtle bottom border (#e5e5e5)
- Padding: py-6
- Text: H1 size, black

### Upload Section Card
- Background: white
- Border: 1px solid #e5e5e5
- Border radius: rounded-xl (12px)
- Padding: p-8 (desktop), p-6 (mobile)
- Shadow: subtle (shadow-sm)

### File Upload Zone
- Dashed border (border-2 border-dashed) in #e5d6c7
- Border radius: rounded-lg
- Padding: py-12
- Background: Very light #e5d6c7 (5% opacity)
- Hover state: Slightly darker background
- Center-aligned icon, text, and browse button
- Icon: Upload cloud icon from Heroicons (48px)

### Input Fields
- Border: 1px solid #e5e5e5
- Border radius: rounded-lg (8px)
- Padding: px-4 py-3
- Focus state: border color #e5d6c7, ring-2 ring-#e5d6c7/20
- Full width (w-full)
- Background: white

### Dropdowns
- Same styling as input fields
- Chevron down icon (Heroicons)
- Options with proper padding and hover states

### Number Input
- Same styling as input fields
- Spinner controls visible
- Min value: 1

### Submit Button
- Background: #000000
- Text: white, medium weight
- Padding: px-8 py-4
- Border radius: rounded-lg
- Full width on mobile
- Hover: slight opacity reduction (hover:bg-gray-900)
- Disabled state: opacity-50, cursor-not-allowed
- Loading state: spinner icon + "Processing..." text

### Status Messages
- Success: Green background (#22c55e/10), green text, green border-left (4px)
- Error: Red background (#ef4444/10), red text, red border-left (4px)
- Padding: p-4
- Border radius: rounded-lg
- Margin: mt-6

### Form Layout
- Vertical stack with consistent gap-6
- Labels above inputs (text-sm, font-medium, mb-2)
- Hint text below inputs when needed (text-xs, text-gray-500)
- Mutual exclusivity indicator: "OR" divider between file upload and YouTube URL (centered, with horizontal lines on sides)

## Visual Hierarchy
1. **Page Header**: Most prominent
2. **Upload Options**: Primary visual weight (file drop zone or YouTube input)
3. **Configuration Options**: Secondary (dropdowns and number input)
4. **Submit Button**: Strong CTA, visually distinct
5. **Status Messages**: Attention-grabbing when present

## Responsive Behavior
- **Desktop (lg:)**: max-w-2xl centered container, comfortable spacing
- **Tablet (md:)**: Maintain layout, slightly reduced padding
- **Mobile (base)**: Single column, full width inputs, reduced padding (p-4)

## Interaction States
- **File Upload**: Drag-over state with enhanced #e5d6c7 background
- **Form validation**: Real-time error messages below invalid fields
- **Submission**: Disable all inputs, show loading spinner on button
- **Success**: Display success message, option to reset form
- **Error**: Show error message, keep form editable

## No Images Required
This is a utility application - no hero images or decorative imagery needed. Focus on clean, functional interface elements.

## Key UX Principles
- **Clarity**: Make it immediately obvious how to upload (file OR link)
- **Feedback**: Clear loading states, validation messages, and success/error notifications
- **Simplicity**: No distracting animations, straight-to-the-point interface
- **Trust**: Professional appearance to instill confidence in the automation process
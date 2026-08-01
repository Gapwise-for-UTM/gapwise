# Campus Gap Finder

Build a polished, responsive web application called “Gapwise UTM.”

PRODUCT PURPOSE

Gapwise UTM helps University of Toronto Mississauga students understand and use the free periods between their classes. A student uploads the .ics calendar file exported from ACORN. The application parses the timetable entirely inside the browser, displays the weekly schedule, detects gaps between classes, and creates a simple campus-day plan.

IMPORTANT PRIVACY REQUIREMENTS

- Process the uploaded .ics file entirely in the browser.

- Do not upload timetable data to a server.

- Do not use Supabase, authentication, a database, cloud storage, or external AI APIs.

- Do not permanently include the attached example timetable in the public application.

- The attached .ics file is only a development fixture for testing the importer.

- Display: “Your timetable stays on your device.”

TECHNICAL REQUIREMENTS

Use React, TypeScript, and a reliable browser-compatible iCalendar parser such as ical.js.

Parse standard VEVENT fields including:

- SUMMARY

- DTSTART

- DTEND

- DESCRIPTION

- LOCATION

- RRULE

- EXDATE

- TZID

Correctly handle:

- Weekly recurring events

- Multiple meeting days for the same course

- Lectures, tutorials, and practicals

- America/Toronto timezone

- Fall and Winter terms

- Escaped characters such as \,

- Newlines written as \n

- Blank locations

- “ZZ TBA” locations

- Recurrence exceptions and holidays

- VALARM blocks, which should not become timetable events

Normalize each meeting into:

- courseCode

- activityType

- sectionCode

- courseName

- startTime

- endTime

- weekday

- buildingCode

- room

- term

CORE USER FLOW

1. Landing page explains the product.

2. User uploads or drags in an .ics file.

3. App validates that it is a calendar file.

4. App parses the timetable.

5. App separates Fall and Winter.

6. App displays a clean weekly timetable.

7. App identifies gaps between same-day classes.

8. User can remove the timetable and upload another file.

GAP DETECTION

A gap is the period between the end of one class and the beginning of the next class on the same day.

For every gap, show:

- Start and end times

- Total duration

- Previous class and location

- Next class and location

- Estimated usable time

- A classification:

  - Under 30 minutes: “Transition only”

  - 30–59 minutes: “Short break”

  - 60–119 minutes: “Useful study gap”

  - 120 minutes or longer: “Long campus gap”

For now, estimate usable time as:

gap duration minus 15 minutes.

Do not yet build real walking routes or live study-space recommendations.

DESIGN

- Mobile-first and excellent on iPhone and desktop

- Clean academic appearance

- Dark navy, off-white, and restrained blue accents

- Do not copy the official University of Toronto logo or claim affiliation

- Use clear typography and generous spacing

- Accessible keyboard navigation

- Proper form labels

- Strong visible focus states

- Good empty, loading, success, and error states

- Add a light/dark mode toggle

LANDING PAGE

Headline:

“Turn your ACORN timetable into a smarter campus day.”

Subheading:

“Upload your calendar export to find every useful gap between classes. No account required, and your timetable never leaves your device.”

Primary button:

“Upload ACORN calendar”

Also include a small three-step explanation:

1. Export from ACORN

2. Upload the .ics file

3. Review your weekly gap plan

TIMETABLE VIEW

- Fall/Winter term tabs

- Monday through Friday columns on desktop

- A day-by-day list on mobile

- Clearly distinguish LEC, TUT, and PRA

- Show course code, time, building, and room

- Show unknown or online locations clearly

- Do not create overlapping visual elements

GAP VIEW

Provide two display modes:

- Weekly timetable

- Gap plan

The gap plan should group results by weekday and present each gap as a card.

LOCAL STORAGE

Store only:

- Theme preference

- Whether the introductory instructions were dismissed

Do not persist the uploaded timetable unless the user explicitly enables a “Remember on this device” option.

ERROR HANDLING

Give useful messages for:

- Invalid file type

- Calendar containing no classes

- Malformed calendar

- Unsupported recurrence

- Events with missing locations

DEVELOPMENT

Create clean reusable components and strongly typed data models.

Include a synthetic demo timetable available through a “Try a demo” button.

Do not use the attached personal timetable as the public demo data.

Add a visible disclaimer:

“Gapwise UTM is an independent student project and is not affiliated with the University of Toronto.”

Build the complete first working version now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/412c327b-6c36-49f2-864a-1b6499e79461).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

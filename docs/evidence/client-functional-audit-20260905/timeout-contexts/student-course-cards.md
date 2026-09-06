# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-course-layout.spec.ts >> student course cards keep two desktop slots regardless of enrolment count
- Location: e2e/dashboard-course-layout.spec.ts:4:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByLabel('Active courses', { exact: true }).locator('article')
Expected: 3
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByLabel('Active courses', { exact: true }).locator('article')
    5 × locator resolved to 0 elements
      - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=f11e3]:
  - link "Skip to content" [ref=f11e4] [cursor=pointer]:
    - /url: "#main-content"
  - complementary "Primary navigation" [ref=f11e5]:
    - link "Dashboard" [ref=f11e6] [cursor=pointer]:
      - /url: /
      - img "X—LEARN" [ref=f11e7]
    - button "Collapse navigation" [expanded] [ref=f11e8] [cursor=pointer]
    - navigation [ref=f11e12]:
      - list [ref=f11e13]:
        - listitem [ref=f11e14]:
          - link "Dashboard" [ref=f11e15] [cursor=pointer]:
            - /url: /
        - listitem [ref=f11e17]:
          - link "My Courses" [ref=f11e18] [cursor=pointer]:
            - /url: /course
        - listitem [ref=f11e20]:
          - link "Study Plan" [ref=f11e21] [cursor=pointer]:
            - /url: /my-plan
        - listitem [ref=f11e23]:
          - link "Exams" [ref=f11e24] [cursor=pointer]:
            - /url: /mock-exams
        - listitem [ref=f11e26]:
          - link "Calendar" [ref=f11e27] [cursor=pointer]:
            - /url: /calendar
        - listitem [ref=f11e29]:
          - link "Vocabulary" [ref=f11e30] [cursor=pointer]:
            - /url: /vocabulary
  - generic [ref=f11e35]:
    - banner [ref=f11e36]:
      - search [ref=f11e37]:
        - textbox "Search courses" [ref=f11e38]:
          - /placeholder: What do you want to learn?
      - generic [ref=f11e39]:
        - combobox "Language" [ref=f11e40] [cursor=pointer]:
          - option "English" [selected]
          - option "简体中文"
          - option "繁體中文"
        - button "Notifications" [ref=f11e42] [cursor=pointer]
        - generic [ref=f11e46]:
          - generic [ref=f11e51]:
            - strong [ref=f11e52]: Alex Chen
            - generic [ref=f11e53]: review@example.test
          - button "Profile" [ref=f11e54] [cursor=pointer]
    - main [ref=f11e57]:
      - region [ref=f11e58]:
        - heading "Welcome back, Alex Chen!" [level=1] [ref=f11e64]
        - region "Student dashboard" [ref=f11e65]:
          - generic [ref=f11e66]:
            - region [ref=f11e67]:
              - generic [ref=f11e68]:
                - heading "My courses" [level=2] [ref=f11e71]
                - link "View all" [ref=f11e72] [cursor=pointer]:
                  - /url: /course
              - generic [ref=f11e73]:
                - generic "Active courses" [ref=f11e74]:
                  - article [ref=f11e75]:
                    - generic [ref=f11e76]: WR101
                    - generic [ref=f11e81]:
                      - heading "Academic Writing Studio" [level=3] [ref=f11e82]
                      - generic [ref=f11e83]: Ivy Lee
                    - generic [ref=f11e88]: Loading schedule…
                    - generic [ref=f11e92]:
                      - generic [ref=f11e93]: Assignment completion
                      - generic [ref=f11e94]: Loading progress…
                    - 'link "Academic Writing Studio: View course" [ref=f11e97] [cursor=pointer]':
                      - /url: /course/71
                      - text: View course
                  - article [ref=f11e98]:
                    - generic [ref=f11e99]: WR101
                    - generic [ref=f11e104]:
                      - heading "Academic Writing Studio" [level=3] [ref=f11e105]
                      - generic [ref=f11e106]: Ivy Lee
                    - generic [ref=f11e111]: Loading schedule…
                    - generic [ref=f11e115]:
                      - generic [ref=f11e116]: Assignment completion
                      - generic [ref=f11e117]: Loading progress…
                    - 'link "Academic Writing Studio: View course" [ref=f11e120] [cursor=pointer]':
                      - /url: /course/72
                      - text: View course
                  - article [ref=f11e121]:
                    - generic [ref=f11e122]: WR101
                    - generic [ref=f11e127]:
                      - heading "Academic Writing Studio" [level=3] [ref=f11e128]
                      - generic [ref=f11e129]: Ivy Lee
                    - generic [ref=f11e134]: Loading schedule…
                    - generic [ref=f11e138]:
                      - generic [ref=f11e139]: Assignment completion
                      - generic [ref=f11e140]: Loading progress…
                    - 'link "Academic Writing Studio: View course" [ref=f11e143] [cursor=pointer]':
                      - /url: /course/73
                      - text: View course
                - navigation "Course cards" [ref=f11e144]:
                  - button "Previous courses" [ref=f11e145] [cursor=pointer]
                  - generic [ref=f11e148]: 3 active courses
                  - button "Next courses" [ref=f11e149] [cursor=pointer]
            - region [ref=f11e152]:
              - generic [ref=f11e153]:
                - heading "Advisor Tasks" [level=2] [ref=f11e156]
                - link "View all" [ref=f11e157] [cursor=pointer]:
                  - /url: /my-plan?view=tasks
              - status [ref=f11e159]:
                - generic [ref=f11e162]: Loading…
            - region [ref=f11e163]:
              - generic [ref=f11e164]:
                - heading "Exams" [level=2] [ref=f11e167]
                - link "View all" [ref=f11e168] [cursor=pointer]:
                  - /url: /mock-exams
              - status [ref=f11e170]:
                - generic [ref=f11e173]: Loading…
          - complementary "Schedule and alerts" [ref=f11e174]:
            - generic [ref=f11e176]:
              - generic [ref=f11e177]:
                - heading "Learning Schedule" [level=2] [ref=f11e178]
                - link "Open full calendar" [ref=f11e179] [cursor=pointer]:
                  - /url: /calendar
              - generic [ref=f11e180]:
                - generic [ref=f11e181]:
                  - button "Previous month" [ref=f11e182] [cursor=pointer]
                  - strong [ref=f11e183]: September 2026
                  - button "Next month" [ref=f11e184] [cursor=pointer]
                - generic [ref=f11e185]:
                  - generic [ref=f11e186]: M
                  - generic [ref=f11e187]: T
                  - generic [ref=f11e188]: W
                  - generic [ref=f11e189]: T
                  - generic [ref=f11e190]: F
                  - generic [ref=f11e191]: S
                  - generic [ref=f11e192]: S
                - generic [ref=f11e193]:
                  - button "Monday, August 31, 2026" [ref=f11e194] [cursor=pointer]: "31"
                  - button "Tuesday, September 1, 2026" [ref=f11e195] [cursor=pointer]: "1"
                  - button "Wednesday, September 2, 2026" [ref=f11e196] [cursor=pointer]: "2"
                  - button "Thursday, September 3, 2026" [ref=f11e197] [cursor=pointer]: "3"
                  - button "Friday, September 4, 2026" [ref=f11e198] [cursor=pointer]: "4"
                  - button "Saturday, September 5, 2026" [pressed] [ref=f11e199] [cursor=pointer]: "5"
                  - button "Sunday, September 6, 2026" [ref=f11e200] [cursor=pointer]: "6"
                  - button "Monday, September 7, 2026" [ref=f11e201] [cursor=pointer]: "7"
                  - button "Tuesday, September 8, 2026" [ref=f11e202] [cursor=pointer]: "8"
                  - button "Wednesday, September 9, 2026" [ref=f11e203] [cursor=pointer]: "9"
                  - button "Thursday, September 10, 2026" [ref=f11e204] [cursor=pointer]: "10"
                  - button "Friday, September 11, 2026" [ref=f11e205] [cursor=pointer]: "11"
                  - button "Saturday, September 12, 2026" [ref=f11e206] [cursor=pointer]: "12"
                  - button "Sunday, September 13, 2026" [ref=f11e207] [cursor=pointer]: "13"
                  - button "Monday, September 14, 2026" [ref=f11e208] [cursor=pointer]: "14"
                  - button "Tuesday, September 15, 2026" [ref=f11e209] [cursor=pointer]: "15"
                  - button "Wednesday, September 16, 2026" [ref=f11e210] [cursor=pointer]: "16"
                  - button "Thursday, September 17, 2026" [ref=f11e211] [cursor=pointer]: "17"
                  - button "Friday, September 18, 2026" [ref=f11e212] [cursor=pointer]: "18"
                  - button "Saturday, September 19, 2026" [ref=f11e213] [cursor=pointer]: "19"
                  - button "Sunday, September 20, 2026" [ref=f11e214] [cursor=pointer]: "20"
                  - button "Monday, September 21, 2026" [ref=f11e215] [cursor=pointer]: "21"
                  - button "Tuesday, September 22, 2026" [ref=f11e216] [cursor=pointer]: "22"
                  - button "Wednesday, September 23, 2026" [ref=f11e217] [cursor=pointer]: "23"
                  - button "Thursday, September 24, 2026" [ref=f11e218] [cursor=pointer]: "24"
                  - button "Friday, September 25, 2026" [ref=f11e219] [cursor=pointer]: "25"
                  - button "Saturday, September 26, 2026" [ref=f11e220] [cursor=pointer]: "26"
                  - button "Sunday, September 27, 2026" [ref=f11e221] [cursor=pointer]: "27"
                  - button "Monday, September 28, 2026" [ref=f11e222] [cursor=pointer]: "28"
                  - button "Tuesday, September 29, 2026" [ref=f11e223] [cursor=pointer]: "29"
                  - button "Wednesday, September 30, 2026" [ref=f11e224] [cursor=pointer]: "30"
                  - button "Thursday, October 1, 2026" [ref=f11e225] [cursor=pointer]: "1"
                  - button "Friday, October 2, 2026" [ref=f11e226] [cursor=pointer]: "2"
                  - button "Saturday, October 3, 2026" [ref=f11e227] [cursor=pointer]: "3"
                  - button "Sunday, October 4, 2026" [ref=f11e228] [cursor=pointer]: "4"
              - paragraph [ref=f11e230]: Loading schedule…
            - region [ref=f11e231]:
              - heading "Alerts" [level=2] [ref=f11e235]
              - status [ref=f11e237]:
                - generic [ref=f11e240]: Loading…
```

# Test source

```ts
  1  | import {expect, test} from '@playwright/test';
  2  | import {course, fixture, reply} from './workspace-fixtures';
  3  |
  4  | test('student course cards keep two desktop slots regardless of enrolment count', async ({page}, info) => {
  5  |   await fixture(page);
  6  |   let count = 1;
  7  |   await page.route('**/v2/me/courses?**', route => route.fulfill({json: reply({
  8  |     items: Array.from({length: count}, (_, index) => ({...course, id: course.id + index})),
  9  |     total: count, page: 0, size: 100,
  10 |   })}));
  11 |   for (const width of [390, 1440, 1920, 2560]) {
  12 |     await page.setViewportSize({width, height: 1100});
  13 |     let singleWidth = 0;
  14 |     for (count = 1; count <= 3; count++) {
  15 |       await page.goto('/');
  16 |       const strip = page.getByLabel('Active courses', {exact: true});
  17 |       const cards = strip.locator('article');
> 18 |       await expect(cards).toHaveCount(count);
     |                           ^ Error: expect(locator).toHaveCount(expected) failed
  19 |       const card = await cards.first().boundingBox();
  20 |       expect(card).not.toBeNull();
  21 |       if (count === 1) singleWidth = card!.width;
  22 |       else expect(Math.abs(card!.width - singleWidth)).toBeLessThan(2);
  23 |       if (width >= 1920) {
  24 |         const region = await strip.boundingBox();
  25 |         expect(card!.width / region!.width).toBeLessThan(.51);
  26 |         expect(card!.width / region!.width).toBeGreaterThan(.4);
  27 |         if (count === 3) {
  28 |           const next = page.getByRole('button', {name: 'Next courses', exact: true});
  29 |           await expect(next).toBeEnabled();
  30 |           await next.click();
  31 |           await expect.poll(() => strip.evaluate(element => element.scrollLeft)).toBeGreaterThan(10);
  32 |         }
  33 |       }
  34 |       await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  35 |       if (count === 1) await page.screenshot({path: info.outputPath(`student-single-course-${width}.png`), fullPage: true});
  36 |     }
  37 |   }
  38 | });
  39 |
  40 | test('advisor schedule preserves available sessions and retries a failed course read', async ({page}) => {
  41 |   await fixture(page, 'ADVISOR');
  42 |   let unavailable = true;
  43 |   const requests: URLSearchParams[] = [];
  44 |   await page.route('**/v2/advisor/courses?**', route => route.fulfill({json: reply({items: [
  45 |     {courseId: 71, title: 'Available course'}, {courseId: 72, title: 'Recovered course'},
  46 |   ], total: 2, page: 0, size: 20})}));
  47 |   await page.route('**/v2/courses/*/session-occurrences?**', route => {
  48 |     const url = new URL(route.request().url());
  49 |     requests.push(url.searchParams);
  50 |     if (url.pathname.includes('/72/') && unavailable) return route.fulfill({status: 403, json: {code: 'FORBIDDEN', message: 'Access denied'}});
  51 |     return route.fulfill({json: reply([{occurrenceId: 901, occurrenceDate: url.searchParams.get('from'), startTime: '10:00:00', endTime: '11:30:00'}])});
  52 |   });
  53 |   await page.goto('/advisor/operations');
  54 |   const schedule = page.getByRole('region', {name: 'Learning Schedule', exact: true});
  55 |   await expect(schedule.getByText('Available course', {exact: true})).toBeVisible();
  56 |   await expect(schedule.getByRole('alert')).toContainText('Some course sessions could not be displayed.');
  57 |   await expect(schedule.getByText(/No course sessions/)).toHaveCount(0);
  58 |   unavailable = false;
  59 |   await schedule.getByRole('button', {name: 'Retry', exact: true}).click();
  60 |   await expect(schedule.getByText('Recovered course', {exact: true})).toBeVisible();
  61 |   await expect(schedule.getByRole('alert')).toHaveCount(0);
  62 |   expect(requests.length).toBe(4);
  63 |   for (const params of requests) {
  64 |     expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  65 |     expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  66 |     expect(params.get('includeHistory')).toBe('false');
  67 |   }
  68 | });
  69 |
```

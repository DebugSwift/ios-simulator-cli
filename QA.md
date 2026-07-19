# Quality Assurance

This guide contains manual quality assurance tests to make sure all commands are functional on release.

Run each step from your terminal with a booted iOS simulator.

## Test Case: Photos app

**Note:** This test case was written using iOS 17.2 and the native Photos app. It may need to be adjusted for other iOS versions or Photos app changes.

1. Open the native Photos app in the iOS simulator.
2. Run `ios-simulator-cli get-booted-sim-id` to get the UDID of the booted simulator.
3. Run `ios-simulator-cli record-video` to start recording.
4. Run `ios-simulator-cli ui describe-all` to make sure we are on the All Photos tab.
5. Run `ios-simulator-cli ui find-element --search "Search" --type Button` to find the Search tab button.
6. Run `ios-simulator-cli ui describe-point --x <x> --y <y>` using coordinates from the find-element result.
7. Run `ios-simulator-cli ui tap --x <x> --y <y>` to tap the Search tab button.
8. Tap the search text input with `ios-simulator-cli ui tap`.
9. Run `ios-simulator-cli ui type "Photos"`.
10. Run `ios-simulator-cli ui describe-all` to find the first photo result.
11. Run `ios-simulator-cli ui describe-point` on the first photo result coordinates.
12. Run `ios-simulator-cli ui tap` on the first photo result.
13. Run `ios-simulator-cli ui swipe --x-start 200 --y-start 400 --x-end 200 --y-end 700` to dismiss the photo.
14. Run `ios-simulator-cli ui describe-all` to confirm we are back on the All Photos tab.
15. Run `ios-simulator-cli screenshot --output photos-test.png`.
16. Run `ios-simulator-cli ui view --output photos-view.jpg`.
17. Run `ios-simulator-cli stop-recording`.

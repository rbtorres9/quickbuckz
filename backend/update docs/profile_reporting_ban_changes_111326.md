# Changelog

## 2026-11-13 — Profile reporting and moderation

### Changed
- **Private profiles can be reported.** Anyone can see a private profile's name, profile picture and banner, so those can still break site rules. Previously, reporting a private profile you don't follow returned a 404.
  - `backend/moderation/views.py` (`ProfileReportView`): finds the profile with `active_profiles()` instead of `visible_profiles(request.user)`. Banned (deactivated) users still can't be reported.
  - The report's snapshot (`target_content`) includes the bio only if the reporter could see it. A private bio the reporter couldn't see is left out, so the snapshot shows only what they could actually report.
- **A ban closes all open reports against the user.** Before, banning a user only closed their open **profile** reports. It now also closes open **post** and **comment** reports against them. Those cards move to Reviewed with *Action Taken: Deactivated account*.
  - `backend/moderation/services.py` (`deactivate_user`): the report filter changed from `target_type=PROFILE, target_author=target` to `target_author=target`. Comment updated to match.
  - In moderation logs, a ban counts as **Via reports** if it closed any open report (profile, post or comment). With no open reports it's logged as not via reports. Mods don't need to enter anything for this.


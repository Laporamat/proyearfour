# Test Credentials

## Emergent-managed Google Auth
- Google OAuth is used — no app-managed passwords.
- To test end-to-end without real Google account, seed a session in MongoDB
  and set the `session_token` cookie (or `Authorization: Bearer …`) in the browser.

### Seeded demo user (persistent, safe to keep)
```
user_id       : user_demo
email         : demo@quantai.local
name          : Demo User
session_token : demo_session_persistent
expires_at    : now + 7 days
```

Re-seed anytime with:
```bash
mongosh --quiet --eval "
use('quantai');
var uid='user_demo', tok='demo_session_persistent';
db.users.replaceOne({user_id: uid}, {
  user_id: uid, email:'demo@quantai.local', name:'Demo User',
  picture:'https://ui-avatars.com/api/?name=Demo+User&background=2f5bd6&color=fff',
  created_at:new Date(), last_login:new Date()
},{upsert:true});
db.user_sessions.deleteMany({user_id: uid});
db.user_sessions.insertOne({
  user_id: uid, session_token: tok,
  expires_at: new Date(Date.now()+7*24*60*60*1000), created_at:new Date()
});
"
```

### Testing playbook
See `/app/auth_testing.md` for the full checklist.

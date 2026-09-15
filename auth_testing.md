# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('quantai');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
curl -X GET "$BACKEND_URL/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing
Set `session_token` cookie manually, then navigate to `/dashboard`.

## Checklist
- [ ] Landing `/` renders unauthenticated
- [ ] Google login button → auth.emergentagent.com with proper redirect
- [ ] AuthCallback processes `session_id` fragment → sets cookie → redirects to `/dashboard`
- [ ] Protected `/dashboard` requires auth, redirects to `/login` if not
- [ ] `/api/auth/me` returns user JSON when authenticated
- [ ] `/api/auth/logout` clears cookie and DB session
- [ ] User dropdown shows name/email/picture

import axios, { AxiosError } from 'axios';
import io from 'socket.io-client';

const API_URL = 'http://localhost:3000';
const AI_URL = 'http://localhost:8000';

const client = axios.create({ baseURL: API_URL, validateStatus: () => true });

async function runTests() {
  console.log('--- STARTING LIVE TESTS ---\n');

  // We will need shared state
  let token1 = '';
  let token2 = '';
  let tokenAdmin = '';
  let auctionId = '';
  let notificationId = '';

  const rand = Math.floor(Math.random() * 100000);
  const user1Email = `user1_${rand}@test.com`;
  const user2Email = `user2_${rand}@test.com`;

  console.log('=== STEP 4: Live Endpoint Testing ===');

  // 1. Auth flow: register -> login -> me -> refresh -> logout
  let res = await client.post('/auth/register', { email: user1Email, password: 'Password123!', name: 'User One' });
  console.log(`Register User 1: ${res.status}`);
  
  res = await client.post('/auth/login', { email: user1Email, password: 'Password123!' });
  console.log(`Login User 1: ${res.status}`);
  token1 = res.data.accessToken;
  const refreshToken = res.data.refreshToken;
  client.defaults.headers.common['Authorization'] = `Bearer ${token1}`;

  res = await client.get('/auth/me');
  console.log(`Auth Me: ${res.status} (User ID: ${res.data.user.id})`);
  const user1Id = res.data.user.id;

  res = await client.post('/auth/refresh', { refreshToken });
  console.log(`Auth Refresh: ${res.status}`);
  token1 = res.data.accessToken;
  client.defaults.headers.common['Authorization'] = `Bearer ${token1}`;

  // Register User 2 for bidding and Admin for admin tests
  res = await client.post('/auth/register', { email: user2Email, password: 'Password123!', name: 'User Two' });
  res = await client.post('/auth/login', { email: user2Email, password: 'Password123!' });
  token2 = res.data.accessToken;

  // We rely on the seed script for admin
  res = await client.post('/auth/login', { email: 'admin@auction.test', password: 'Admin1234!' });
  tokenAdmin = res.data.accessToken;

  // 2. Auction flow: create -> get -> list -> update -> search
  res = await client.post('/auctions', {
    title: 'Live Test Auction',
    description: 'Testing live endpoints',
    category: 'electronics',
    startingPrice: 100,
    reservePrice: 200,
    startsAt: new Date(Date.now() - 10000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString()
  });
  console.log(`Create Auction: ${res.status}`);
  auctionId = res.data.auction.id;

  res = await client.get(`/auctions/${auctionId}`);
  console.log(`Get Auction: ${res.status}`);

  res = await client.get('/auctions');
  console.log(`List Auctions: ${res.status} (Total: ${res.data.total})`);

  res = await client.patch(`/auctions/${auctionId}`, { title: 'Updated Test Auction' });
  console.log(`Update Auction: ${res.status}`);

  res = await client.get('/search?q=Updated');
  console.log(`Search Auction: ${res.status} (Total: ${res.data.total})`);

  // 3. Bid flow
  // Set auth to User 2 so we don't bid as seller
  client.defaults.headers.common['Authorization'] = `Bearer ${token2}`;

  res = await client.post('/bids', { auctionId, amount: 110 });
  console.log(`Place Valid Bid (User 2): ${res.status} (Expected 201) ${res.status !== 201 ? JSON.stringify(res.data) : ''}`);

  res = await client.post('/bids', { auctionId, amount: 50 });
  console.log(`Place Low Bid (User 2): ${res.status} (Expected 422 or 409) ${res.status !== 409 && res.status !== 422 ? JSON.stringify(res.data) : ''}`);

  // Find an ended auction from the seed
  res = await client.get('/search?status=ENDED');
  const endedAuctionId = res.data.results.find((a: any) => a.status === 'ENDED')?.id;
  if (endedAuctionId) {
    res = await client.post('/bids', { auctionId: endedAuctionId, amount: 9999 });
    console.log(`Place Bid on Ended Auction: ${res.status} (Expected 410)`);
  }

  // Set auth to User 1 (seller) to test self_bidding
  client.defaults.headers.common['Authorization'] = `Bearer ${token1}`;
  res = await client.post('/bids', { auctionId, amount: 200 });
  console.log(`Place Bid as Seller: ${res.status} (Expected 403) ${res.status !== 403 ? JSON.stringify(res.data) : ''}`);

  // 4. Watchlist flow
  res = await client.post(`/watchlist/${auctionId}`, {});
  console.log(`Add to Watchlist: ${res.status} ${res.status !== 201 ? JSON.stringify(res.data) : ''}`);

  res = await client.get('/watchlist');
  console.log(`Get Watchlist: ${res.status} (Items: ${res.data.watchlist.length})`);
  const watchlistItemId = auctionId; // id is the auctionId in path

  res = await client.delete(`/watchlist/${watchlistItemId}`);
  console.log(`Remove from Watchlist: ${res.status}`);

  // 5. Media flow
  const form = new FormData();
  form.append('auctionId', auctionId);
  const blob = new Blob(['fake image'], { type: 'image/png' });
  form.append('file', blob, 'test.png');
  res = await client.post('/media/upload', form);
  console.log(`Upload Media: ${res.status} (If 400 invalid_file_type then ok)`);

  // 6. Payment flow
  if (endedAuctionId) {
    // Need an ended auction where I am the winner. Let's find one by creating and ending it manually via DB, or just use admin to fetch one?
    // Let's just try to call it and see status
    res = await client.post('/payments/checkout', { auctionId: endedAuctionId });
    console.log(`Payment Checkout: ${res.status} (Expected 403 or 400 since we may not be winner)`);
  }

  // 7. Notifications flow
  res = await client.get('/notifications');
  console.log(`Get Notifications: ${res.status}`);
  
  res = await client.get('/notifications/unread-count');
  console.log(`Get Unread Count: ${res.status}`);
  
  res = await client.patch('/notifications/read-all');
  console.log(`Mark Read: ${res.status}`);

  // 8. Reviews flow
  res = await client.post('/reviews', { auctionId, rating: 5, comment: 'Great!' });
  console.log(`Review Active Auction: ${res.status} (Expected 400/403)`);

  res = await client.get(`/reviews?auctionId=${auctionId}`);
  console.log(`Get Reviews: ${res.status}`);

  // 9. Recommendations flow
  res = await client.get(`/auctions/recommendations/${user1Id}`);
  console.log(`Get Recommendations (Own): ${res.status}`);

  res = await client.get(`/auctions/recommendations/some-other-uuid-1234-5678-901234567890`);
  console.log(`Get Recommendations (Other User): ${res.status} (Expected 403)`);

  // 10. Admin flow
  client.defaults.headers.common['Authorization'] = `Bearer ${tokenAdmin}`;
  res = await client.get('/admin/stats');
  console.log(`Admin Stats: ${res.status}`);

  res = await client.get('/admin/fraud-flags');
  console.log(`Admin Fraud Flags: ${res.status}`);

  res = await client.get('/admin/users');
  console.log(`Admin Users: ${res.status}`);

  const targetUserId = res.data.users.find((u: any) => u.email === user2Email).id;
  res = await client.patch(`/admin/users/${targetUserId}/ban`, { action: 'ban', reason: 'test' });
  console.log(`Admin Ban User: ${res.status} ${res.status !== 200 ? JSON.stringify(res.data) : ''}`);

  res = await client.post('/auth/login', { email: user2Email, password: 'Password123!' });
  console.log(`Login Banned User: ${res.status} (Expected 403)`);

  client.defaults.headers.common['Authorization'] = `Bearer ${tokenAdmin}`;
  res = await client.patch(`/admin/users/${targetUserId}/unban`, { action: 'unban', reason: 'test' });
  console.log(`Admin Unban User: ${res.status} ${res.status !== 200 ? JSON.stringify(res.data) : ''}`);

  res = await client.get('/admin/activity');
  console.log(`Admin Activity Feed: ${res.status} ${res.status !== 200 ? JSON.stringify(res.data) : ''}`);

  // Auth flow logout
  client.defaults.headers.common['Authorization'] = `Bearer ${token1}`;
  res = await client.post('/auth/logout');
  console.log(`Auth Logout: ${res.status}`);

  console.log('\n=== STEP 5: WebSocket Test ===');
  await testWebSockets(token2, auctionId);

  console.log('\n=== STEP 6: Error Handling Test ===');
  await testErrors(token1, tokenAdmin);

  console.log('\n=== STEP 7: AI Stub Test ===');
  await testAIStubs();

  console.log('\n=== STEP 8: Concurrency Test ===');
  await testConcurrency(auctionId);
}

async function testWebSockets(token: string, auctionId: string) {
  return new Promise<void>((resolve) => {
    const socket = io(API_URL, {
      path: '/socket.io/',
      transports: ['websocket'],
    });

    let passed = false;
    let timeout: NodeJS.Timeout;

    socket.on('connect', () => {
      console.log('WS Client 2 Connected');
      socket.emit('room:join', `auction:${auctionId}`);
      
      // Fire a REST bid from "another client" (via axios)
      setTimeout(async () => {
        const ax = axios.create({ baseURL: API_URL, validateStatus: () => true });
        ax.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const res = await ax.post('/bids', { auctionId, amount: 250 });
        console.log(`WS Test REST Bid Status: ${res.status}`);
      }, 500);
    });

    socket.on('bid:new', (payload) => {
      console.log(`WS PASS: Received bid:new payload:`, payload);
      passed = true;
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    timeout = setTimeout(() => {
      if (!passed) {
        console.log('WS FAIL: Did not receive bid:new event within 2 seconds');
      }
      socket.disconnect();
      resolve();
    }, 2000);
  });
}

async function testErrors(token: string, tokenAdmin: string) {
  const ax = axios.create({ baseURL: API_URL, validateStatus: () => true });
  ax.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  let res = await ax.post('/bids', { auctionId: 'not-a-uuid', amount: 100 });
  console.log(`POST /bids non-UUID: ${res.status} body:`, res.data);

  res = await ax.get('/auctions/00000000-0000-0000-0000-000000000000');
  console.log(`GET /auctions nonexistent: ${res.status} body:`, res.data);

  res = await ax.patch('/users/00000000-0000-0000-0000-000000000000', { name: 'Hack' });
  console.log(`PATCH /users/:other-user-id: ${res.status} body:`, res.data);

  res = await ax.get('/admin/stats');
  console.log(`GET /admin/stats non-admin: ${res.status} body:`, res.data);

  res = await ax.post('/auth/login', { email: 'admin@auction.test', password: 'wrong' });
  console.log(`POST /auth/login wrong pass: ${res.status} body:`, res.data);

  res = await ax.post('/auth/refresh', { refreshToken: 'faketoken' });
  console.log(`POST /auth/refresh fake token: ${res.status} body:`, res.data);

  const form = new FormData();
  form.append('auctionId', '00000000-0000-0000-0000-000000000000');
  const blob = new Blob(['pdf fake'], { type: 'application/pdf' });
  form.append('file', blob, 'test.pdf');
  res = await ax.post('/media/upload', form);
  console.log(`POST /media/upload PDF: ${res.status} body:`, res.data);

  res = await ax.post('/reviews', { auctionId: '00000000-0000-0000-0000-000000000000', rating: 5, comment: 'Nice' });
  console.log(`POST /reviews never bid: ${res.status} body:`, res.data);
}

async function testAIStubs() {
  const ax = axios.create({ baseURL: AI_URL, validateStatus: () => true });

  let res = await ax.post('/ai/anti-bot', { 
    user_id: '1', auction_id: 'a', bid_amount: 10, ip_address: '1.2.3.4', 
    session_duration_seconds: 60, bids_in_last_minute: 1, time_to_bid_ms: 1000 
  });
  console.log(`POST /ai/anti-bot: ${res.status} body:`, res.data);

  res = await ax.post('/ai/fraud', { 
    user_id: '1', auction_id: 'a', bid_amount: 10, account_age_days: 10, 
    total_bids_history: 1, ip_country: 'US', bid_velocity_1h: 1 
  });
  console.log(`POST /ai/fraud: ${res.status} body:`, res.data);

  res = await ax.post('/ai/recommend', { 
    user_id: '1', recently_viewed: ['a'], bid_history: ['a'] 
  });
  console.log(`POST /ai/recommend: ${res.status} body:`, res.data);

  res = await ax.get('/health');
  console.log(`GET /health (AI): ${res.status} body:`, res.data);
}

async function testConcurrency(auctionId: string) {
  // We need 10 users to bid simultaneously
  const tokens = [];
  for (let i = 0; i < 10; i++) {
    const email = `conc_${Date.now()}_${Math.random().toString(36).substring(7)}_${i}@test.com`;
    let resReg = await client.post('/auth/register', { email, password: 'Password123!', name: `Conc ${i}` });
    if (resReg.status !== 201) console.log(`Concurrency Register failed: ${resReg.status} body:`, resReg.data);
    let resLog = await client.post('/auth/login', { email, password: 'Password123!' });
    if (resLog.status !== 200) console.log(`Concurrency Login failed: ${resLog.status} body:`, resLog.data);
    tokens.push(resLog.data.accessToken);
  }

  console.log(`Created 10 users. Firing concurrent bids for amount 500...`);
  
  const promises = tokens.map(token => {
    const ax = axios.create({ baseURL: API_URL, validateStatus: () => true });
    ax.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return ax.post('/bids', { auctionId, amount: 500 });
  });

  const results = await Promise.all(promises);
  let status201 = 0;
  let status409 = 0;
  results.forEach(r => {
    if (r.status === 201) status201++;
    else if (r.status === 409) status409++;
    else console.log(`Unexpected status: ${r.status}`);
  });

  console.log(`Concurrency Test Results:`);
  console.log(`  201 Created: ${status201}`);
  console.log(`  409 Conflict (Outbid): ${status409}`);
}

runTests().catch(console.error);

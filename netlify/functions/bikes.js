const http = require('http');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function requestJson(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, parsed });
        } catch (e) {
          resolve({ ok: false, error: '서울시 응답을 해석하지 못했어요.' });
        }
      });
    }).on('error', (e) => {
      resolve({ ok: false, error: e.message });
    });
    req.setTimeout(8000, () => req.destroy(new Error('서울시 따릉이 요청 시간이 초과됐어요.')));
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const BIKE_KEY = process.env.SEOUL_BIKE_API_KEY;

  if (!BIKE_KEY) {
    return json(500, { error: 'SEOUL_BIKE_API_KEY 환경변수가 설정되지 않았어요.' });
  }

  try {
    const rows = [];
    let totalCount = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const start = page * PAGE_SIZE + 1;
      const end = start + PAGE_SIZE - 1;
      const url = `http://openapi.seoul.go.kr:8088/${BIKE_KEY}/json/bikeList/${start}/${end}/`;
      const result = await requestJson(url);

      if (!result.ok) {
        return json(502, { error: result.error || '서울시 따릉이 정보를 불러오지 못했어요.' });
      }

      const status = result.parsed.rentBikeStatus;
      if (!status) {
        const message = result.parsed.RESULT?.MESSAGE || '서울시 따릉이 응답 형식이 예상과 달라요.';
        return json(502, { error: message });
      }

      const pageRows = Array.isArray(status?.row) ? status.row : [];
      totalCount = Number(status?.list_total_count || totalCount || pageRows.length);
      rows.push(...pageRows);

      if (rows.length >= totalCount || pageRows.length < PAGE_SIZE) {
        break;
      }
    }

    return json(200, rows);
  } catch (e) {
    return json(502, { error: e.message || '서울시 따릉이 정보를 불러오지 못했어요.' });
  }
};

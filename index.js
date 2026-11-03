// Gopeed Gofile 扩展（重写版）
// 功能：解析 gofile.io 分享链接（单文件 / 文件夹），递归展开子文件夹，自动处理鉴权。
//
// 相比旧版修复了三处导致“现在用不了”的问题：
//   1. 自动获取并缓存 token（旧版依赖手动填写、已过期失效的 Authorization / accountToken）
//   2. 递归下载子文件夹（旧版只取顶层 children，子文件夹里的文件会漏掉）
//   3. 不再写死 Host 请求头，按每个文件实际的存储服务器（store-x.gofile.io）下载

gopeed.events.onResolve(async function (ctx) {
  gopeed.logger.info('Gofile 扩展开始解析: ' + ctx.req.url);

  var code = extractCode(ctx.req.url);
  if (!code) {
    throw new Error('无法从链接解析 Gofile 内容 ID，请确认是 gofile.io/d/xxx 形式的链接: ' + ctx.req.url);
  }
  gopeed.logger.info('解析到内容 ID: ' + code);

  var token = await getToken();

  var root = await fetchContent(code, token, 1);
  var files = [];

  if (root.type === 'file') {
    // 链接直接指向单个文件
    files.push(buildFile(root, ''));
  } else {
    // 文件夹：处理第 1 页，再按需翻页
    var page = 1;
    var data = root;
    while (true) {
      var children = objValues(data.children);
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.type === 'folder') {
          await listFolder(child.id, token, child.name + '/', files);
        } else {
          files.push(buildFile(child, ''));
        }
      }
      if (data.metadata && data.metadata.hasNextPage) {
        page = page + 1;
        data = await fetchContent(code, token, page);
      } else {
        break;
      }
    }
  }

  if (files.length === 0) {
    throw new Error('该 Gofile 链接中没有可下载的文件（可能是空文件夹，或链接已失效/需要密码）');
  }

  ctx.res = {
    name: root.name || code,
    files: files
  };
  gopeed.logger.info('解析完成，共 ' + files.length + ' 个文件');
});

// 从 gofile 链接中提取内容 ID（/d/ 后面的那段）
function extractCode(rawUrl) {
  var u;
  try {
    u = new URL(rawUrl);
  } catch (e) {
    return '';
  }
  var parts = u.pathname.split('/');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === 'd' && i + 1 < parts.length && parts[i + 1].length > 0) {
      return parts[i + 1];
    }
  }
  // 兜底：取最后一个非空路径段
  for (var j = parts.length - 1; j >= 0; j--) {
    if (parts[j].length > 0) return parts[j];
  }
  return '';
}

// 兼容写法，避免依赖 Object.values
function objValues(obj) {
  var arr = [];
  if (!obj) return arr;
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) arr.push(obj[k]);
  }
  return arr;
}

// 获取 token：优先用已缓存 / 设置的，否则自动创建游客账号
async function getToken() {
  var cached = gopeed.storage.get('token');
  if (cached) return cached;

  var setting = gopeed.settings.token;
  if (setting && setting.length > 0) {
    gopeed.storage.set('token', setting);
    return setting;
  }

  gopeed.logger.info('未配置 token，正在自动创建游客账号...');
  var resp = await fetch('https://api.gofile.io/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  var json = await resp.json();
  if (json.status === 'ok' && json.data && json.data.token) {
    gopeed.storage.set('token', json.data.token);
    gopeed.logger.info('游客账号创建成功');
    return json.data.token;
  }
  throw new Error('创建 Gofile 游客账号失败: ' + JSON.stringify(json));
}

// 拉取某个内容（文件/文件夹）的元数据
async function fetchContent(id, token, page) {
  var url = 'https://api.gofile.io/contents/' + id + '?page=' + page + '&pageSize=1000&cache=true';
  var resp = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  var json = await resp.json();
  if (json.status !== 'ok') {
    throw new Error('Gofile API 返回错误: ' + JSON.stringify(json));
  }
  return json.data;
}

// 递归展开子文件夹
async function listFolder(folderId, token, prefix, files) {
  var page = 1;
  while (true) {
    var data = await fetchContent(folderId, token, page);
    var children = objValues(data.children);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.type === 'folder') {
        await listFolder(child.id, token, prefix + child.name + '/', files);
      } else {
        files.push(buildFile(child, prefix));
      }
    }
    if (data.metadata && data.metadata.hasNextPage) {
      page = page + 1;
    } else {
      break;
    }
  }
}

// 构造 Gopeed 需要的文件描述
function buildFile(item, prefix) {
  var link = item.link || item.directLink || item.downloadLink || '';
  return {
    name: prefix + (item.name || 'file'),
    size: item.size || 0,
    req: {
      url: link,
      extra: {
        header: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://gofile.io/',
          'Origin': 'https://gofile.io/',
          'Accept': '*/*',
          'Cookie': 'accountToken=' + (gopeed.storage.get('token') || '')
        }
      }
    }
  };
}

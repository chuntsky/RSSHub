const url = require('url');
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');
const rootUrl = 'https://www.mot.gov.cn/';

// 交通运输部 内河航运
const config = {
    changjianghangyunzsfx: { title: '长江航运指数分析', link: 'yunjiazhishu/changjianghangyunzsfx' },
    zhujiangshuiyunjjyxfx: { title: '珠江水运经济运行分析', link: 'yunjiazhishu/zhujiangshuiyunjjyxfx' },
};

module.exports = async (ctx) => {
    const cfg = config[ctx.params.caty];
    if (!cfg) {
        throw Error('Bad category. ');
    }

    const currentUrl = url.resolve(rootUrl, cfg.link);
    const response = await got({ method: 'get', url: currentUrl });

    const $ = cheerio.load(response.data);
    const list = $('a.list-group-item')
        .map((_, item) => {
            item = $(item);
            const span = $(item).find('span.badge');
            return {
                title: item.attr('title'),
                link: currentUrl + item.attr('href').substring(1),
                pubDate: parseDate(span.text(), 'YYYY-MM-DD'),
            };
        })
        .get();

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const detailResponse = await got({ method: 'get', url: item.link });
                const content = cheerio.load(detailResponse.data);
                item.description = content('#Zoom').html();
                // item.pubDate = new Date(content("h3 > font").text().match(/[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/).toString().substring(0, 10) + ' GMT+8').toUTCString();
                return item;
            })
        )
    );

    ctx.state.data = {
        title: '交通运输部 - ' + cfg.title,
        link: currentUrl,
        item: items,
    };
};

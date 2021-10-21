const url = require('url');
const got = require('@/utils/got');
const cheerio = require('cheerio');

const rootUrl = 'http://www.yuexiu.gov.cn/';

const config = {
    xxtg: {
        link: '/gzjg/qzf/qjyj/jyzl/gk/xxtg/',
        title: '信息通告',
    },
    zktz: {
        link: '/gzjg/qzf/qjyj/jyzl/gk/zktz/',
        title: '招考通知',
    },
};

module.exports = async (ctx) => {
    const cfg = config[ctx.params.caty];
    if (!cfg) {
        throw Error('Bad category. ');
    }

    const currentUrl = url.resolve(rootUrl, cfg.link);
    const response = await got({ method: 'get', url: currentUrl });

    const $ = cheerio.load(response.data);
    const list = $('div.public_list_con ul li')
        .map((_, item) => {
            item = $(item).find('a');
            return {
                title: item.attr('title'),
                link: item.attr('href'),
            };
        })
        .get();

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const detailResponse = await got({ method: 'get', url: item.link });
                const content = cheerio.load(detailResponse.data);
                item.description = content('div.text_con_main').html();
                item.pubDate = new Date(content('div.text_con_tit > p > span:nth-child(2)').text().replace(/发布时间：/, '') + ' GMT+8').toUTCString();
                return item;
            })
        )
    );

    ctx.state.data = {
        title: '越秀区教育局 - ' + cfg.title,
        link: currentUrl,
        item: items,
    };
};

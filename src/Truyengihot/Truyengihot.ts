import {
    MangaUpdates,
    TagSection,
    SourceManga,
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SearchRequest,
    PagedResults,
    Request,
    Response,
    ChapterProviding,
    MangaProviding,
    SearchResultsProviding,
    HomePageSectionsProviding,
    SourceInfo,
    ContentRating,
    SourceIntents,
    BadgeColor,
} from '@paperback/types';

import { Parser } from './TruyengihotParser';

const DOMAIN = 'https://Truyengihotqua.net/';

export const isLastPage = ($: CheerioStatic): boolean => {
    const current = $('ul.pagination > li.active > a').text();
    let total = $('ul.pagination > li.PagerSSCCells:last-child').text();

    if (current) {
        total = total ?? '';
        return (+total) === (+current); //+ => convert value to number
    }
    return true;
}

export const TruyengihotInfo: SourceInfo = {
    version: '1.0.8',
    name: 'Truyengihot',
    icon: 'icon.png',
    author: 'HiepHoang2',
    authorWebsite: 'https://github.com/HiepHoang2190/',
    description: 'Extension that pulls manga from Truyengihot.',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'Recommended',
            type: BadgeColor.BLUE
        },
        {
            text: 'Notifications',
            type: BadgeColor.GREEN
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS
};

export class Truyengihot implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {

    constructor(private cheerio: CheerioAPI) { }

    readonly requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': DOMAIN,
                        'user-agent': await this.requestManager.getDefaultUserAgent(),
                    }
                };
                return request;
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response;
            }
        }
    });

    getMangaShareUrl(mangaId: string): string {
        return `${DOMAIN}/${mangaId}`;

    }

    parser = new Parser();

    private async DOMHTML(url: string): Promise<CheerioStatic> {
        const request = App.createRequest({
            url: url,
            method: 'GET',
        });
        const response = await this.requestManager.schedule(request, 1);
        return this.cheerio.load(response.data as string);
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const $ = await this.DOMHTML(`${DOMAIN}/${mangaId}`);
        return this.parser.parseMangaDetails($, mangaId);
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const $ = await this.DOMHTML(`${DOMAIN}/${mangaId}`);
        return this.parser.parseChapterList($);
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const $ = await this.DOMHTML(`${DOMAIN}/${chapterId}`);
        const pages = this.parser.parseChapterDetails($);
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
        })
    }

    async supportsTagExclusion(): Promise<boolean> {
        return true;
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1;

        const search = {
            genres: '',
            exgenres: '',
            gender: "-1",
            status: "-1",
            minchapter: "1",
            sort: "0"

        };

        const extags = query.excludedTags?.map(tag => tag.id) ?? [];
        const exgenres: string[] = [];
        for (const value of extags) {
            if (value.indexOf('.') === -1) {
                exgenres.push(value);
            }
        }

        const tags = query.includedTags?.map(tag => tag.id) ?? [];
        const genres: string[] = [];
        for (const value of tags) {
            if (value.indexOf('.') === -1) {
                genres.push(value);
            } else {
                const [key, val] = value.split(".");
                switch (key) {
                    case 'minchapter':
                        search.minchapter = String(val);
                        break;
                    case 'gender':
                        search.gender = String(val);
                        break;
                    case 'sort':
                        search.sort = String(val);
                        break;
                    case 'status':
                        search.status = String(val);
                        break;
                }
            }
        }
        search.genres = genres.join(",");
        search.exgenres = exgenres.join(",");
        const paramExgenres = search.exgenres ? `&notgenres=${search.exgenres}` : '';

        const url = `${DOMAIN}${query.title ? '/danh-sach-truyen.html' : '/danh-sach-truyen.html'}`;
        const param = encodeURI(`?text_add=${query.title ?? ''}`);
        const $ = await this.DOMHTML(url + param);
        const tiles = this.parser.parseSearchResults($);
        metadata = !isLastPage($) ? { page: page + 1 } : undefined;

        return App.createPagedResults({
            results: tiles,
            metadata
        });
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        console.log('Truyengihot Running...')
        const sections: HomeSection[] = [
            // App.createHomeSection({ id: 'featured', title: "Truyện Ngôn Tình Mới", containsMoreItems: false, type: HomeSectionType.featured }),
            App.createHomeSection({ id: 'new_18', title: "Truyện 18+ Mới", containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'hot', title: "Truyện Ngôn Tình Mới", containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            // App.createHomeSection({ id: 'new_updated', title: "Truyện Mới Cập Nhật", containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            // App.createHomeSection({ id: 'new_added', title: "Truyện Mới Thêm Gần Đây", containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            // App.createHomeSection({ id: 'full', title: "Truyện Đã Hoàn Thành", containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
        ];

        for (const section of sections) {
            sectionCallback(section);
            let url: string;
            switch (section.id) {
                // case 'featured':
                //     url = `${DOMAIN}danh-sach-truyen.html?listType=thumb&type_add=noaudult`;
                //     break;
                case 'new_18':
                    url = `${DOMAIN}danh-sach-truyen.html?listType=thumb&type_add=audult`;
                    break;
                case 'hot':
                    url = `${DOMAIN}danh-sach-truyen.html?listType=thumb&type_add=noaudult`;
                    break;
                // case 'new_updated':
                //     url = `${DOMAIN}`;
                //     break;
                // case 'new_added':
                //     url = `${DOMAIN}tim-truyen?status=-1&sort=15`;
                //     break;
                // case 'full':
                //     url = `${DOMAIN}truyen-full`;
                //     break;
                // default:
                //     throw new Error("Invalid homepage section ID");
            }

            const $ = await this.DOMHTML(url);
            switch (section.id) {
                // case 'featured':
                //     section.items = this.parser.parseFeaturedSection($);
                //     break;
                case 'new_18':
                    section.items = this.parser.parsePopularSection($);
                    break;
                case 'hot':
                    section.items = this.parser.parsePopularSection($);
                    break;
                // case 'new_updated':
                //     section.items = this.parser.parseNewUpdatedSection($);
                //     break;
                // case 'new_added':
                //     section.items = this.parser.parseNewAddedSection($);
                //     break;
                // case 'full':
                //     section.items = this.parser.parseFullSection($);
                //     break;
            }
            sectionCallback(section);
           
        }
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1;
        let param = "";
        let url = "";

        switch (homepageSectionId) {
            // case "featured":
            //     param = `&text_add=&genre_add=0&format_add=0&magazine_add=0&tag_add=&tag_remove=&explicit_add=0&themes_add=&themes_remove=&country_add=&group_add=0&status_add=0&order_add=last_update&order_by_add=DESC&page=${page}`;
            //     url = `${DOMAIN}`;
            //     break;
            case "new_18":
                param = `&text_add=&genre_add=0&format_add=0&magazine_add=0&tag_add=&tag_remove=&explicit_add=0&themes_add=&themes_remove=&country_add=&group_add=0&status_add=0&order_add=last_update&order_by_add=DESC&page=${page}`;
                url = `${DOMAIN}danh-sach-truyen.html?listType=thumb&type_add=audult`;
                break;
            case "hot":
                param = `&text_add=&genre_add=0&format_add=0&magazine_add=0&tag_add=&tag_remove=&explicit_add=0&themes_add=&themes_remove=&country_add=&group_add=0&status_add=0&order_add=last_update&order_by_add=DESC&page=${page}`;
                url = `${DOMAIN}danh-sach-truyen.html?listType=thumb&type_add=noaudult`;
                break;
            // case "new_updated":
            //     param = `?page=${page}`;
            //     url = DOMAIN;
            //     break;
            // case "new_added":
            //     param = `?status=-1&sort=15&page=${page}`;
            //     url = `${DOMAIN}tim-truyen`;
            //     break;
            // case "full":
            //     param = `?page=${page}`;
            //     url = `${DOMAIN}truyen-full`;
            //     break;
            default:
                throw new Error("Requested to getViewMoreItems for a section ID which doesn't exist");
        }

        const request = App.createRequest({
            url,
            method: 'GET',
            param,
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data as string);

        const manga = this.parser.parseViewMoreItems($);
        metadata = isLastPage($) ? undefined : { page: page + 1 };

        return App.createPagedResults({
            results: manga,
            metadata
        });
    }

    async getSearchTags(): Promise<TagSection[]> {
        const url = `${DOMAIN}`;
        const $ = await this.DOMHTML(url);
        return this.parser.parseTags($);
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        const updateManga: any = [];
        const pages = 10;
        for (let i = 1; i < pages + 1; i++) {
            // const request = createRequestObject({
            //     url: DOMAIN + '?page=' + i,
            //     method: 'GET',
            // })
            // const response = await this.requestManager.schedule(request, 1)
            // const $ = this.cheerio.load(response.data);
            let url = `${DOMAIN}?page=${i}`
            const $ = await this.DOMHTML(url);
            const updateManga = $('div.item', 'div.row').toArray().map(manga => {
                const id = $('figure.clearfix > div.image > a', manga).attr('href')?.split('/').pop();
                const time = $("figure.clearfix > figcaption > ul > li.chapter:nth-of-type(1) > i", manga).last().text().trim();
                return {
                    id: id,
                    time: time
                };
            });

            updateManga.push(...updateManga);

        }

        const returnObject = this.parser.parseUpdatedManga(updateManga, time, ids)
        mangaUpdatesFoundCallback(App.createMangaUpdates(returnObject))
    }
}
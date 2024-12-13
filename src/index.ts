import * as cheerio from 'cheerio';
import axios from "axios"
import logger from './logger';
import { AgencyInfo } from './json.type';
import { writeFile, appendFile } from 'fs/promises';


const COOKIES = "SOCS=CAISHAgCEhJnd3NfMjAyNDAzMTktMF9SQzEaAmZyIAEaBgiA_YKwBg; NID=520=TnY5_op8ahBQtxs0jNobeoSwatLUbvPG2z5tThABd53A-OTgTLXSu8WJFq5JqFLdC266NVkYXd7osZxxiHP1Aa15eNYZHZsp68rxjTAAbQBY4PzX9reeOGFt8WQCcP1lFYw0yvEHtyvUHk_U77YFPiGx_foFrhZ4Jp99RM8uWNLVEZ0qFBBEAyR4UTUkosg-g6bsjOSmcGCiluvHO-FETw1bErQ38QsT-zNbGmNDvgAQIiSqbZ89fnm132o-9lKQG96LzvI4WoxFQK57v4s4h5F89oozqMNsAYdl3okqMKearVRSxSG2QluI0IQ7RaaOQEN_IBc4ofCvRFapo4va6EoGdHt3xj9Uly2ePW0O8NoxV7Gno7nUrVdk7owX2AWeyt_VwkDhncTbA5O9BmxZdbH_1D_8-t6Hn8_p_wlm8S44-VKHsQdG_p2u35Gevw4o32N9nw6jrf-TX7HidJhGEX3V7mSuB1cqnczPmGXlOb5eh_s3cpM0v8TYMJ1l7tsv3JmVbroB4kpa3Ls41kmA3cSEEvFJ52cU7CfrIBbx__qO1Rv3QltHqQ5HO3Egb1pmbOEXDa14G2t1g55thUjC36vh_F_ND7BFuYq1wa4fnFec2G5e3AiSsTLe5fQknkDYfPLPDXOG8VOtd4fiUo2Sqn8Jk-0Ft1Zx0DX_7PQuffmdX0SJsWw8eX7GYZNDaJx-wnW2B2AGe3qZuYJpcGXPDVK3n1TFJFGzTQosPhEV8vS2MuQPbY6Zc5VN2kQhVrF1tb-yfJabuNpDMVcT9ZgX1TeWg_5d020";

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Priority': 'u=0, i',
    'Te': 'trailers'
};

function generateGoogleSearchUrls(query: string, maxPages: number): string[] {
    const encodedQuery = encodeURIComponent(query);

    const baseParams = {
        sca_esv: 'e405cdfcb7e67cb0',
        rlz: '1C5CHFA_enFR1136FR1136',
        udm: '1',
        biw: '1920',
        bih: '883',
        dpr: '1'
    };

    const baseParamsString = Object.entries(baseParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    const urls = [];
    for (let page = 0; page < maxPages; page++) {
        const start = page * 10;
        const url = `https://www.google.com/search?q=${encodedQuery}&${baseParamsString}&start=${start}`;
        urls.push(url);
    }

    return urls;
}

async function getHtml(url: string): Promise<string> {
    logger.info(`Récupération du HTML pour l'URL: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                ...HEADERS,
                'Cookie': COOKIES,
                'Host': 'www.google.com'
            }
        });

        if (response.data) {
            logger.success(`HTML récupéré avec succès pour: ${url}`);
            const $ = cheerio.load(response.data);
            const htmlContent = $('html').html() || "";
            return htmlContent;
        }

        logger.warn(`Aucun contenu HTML trouvé pour: ${url}`);
        return "";

    } catch (error) {
        logger.error(`Erreur lors de la récupération du HTML pour ${url}:`, error);
        return "";
    }
}


function countGooglePaginationElements(html: string) {
    const $ = cheerio.load(html);

    const elements = $('td.NKTSme');

    return elements.length;
}

function cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}


function extractAddressFromDirectionLink(href: string): string {
    const addressMatch = href.match(/\/maps\/dir\/\/(.*?)\/data=/);
    if (addressMatch && addressMatch[1]) {
        // Décoder l'URL et remplacer les + par des espaces
        const fullAddress = decodeURIComponent(addressMatch[1].replace(/\+/g, ' '));
        
        // Séparer le nom de l'adresse en utilisant la virgule
        const parts = fullAddress.split(',');
        
        // Retirer le premier élément (nom) et joindre le reste
        if (parts.length > 1) {
            return parts.slice(1).join(',').trim();
        }
        return fullAddress;
    }
    return '';
}

function extractAgencyInfo(html: string): AgencyInfo[] {
    const $ = cheerio.load(html);
    const agencies: AgencyInfo[] = [];

    $('.VkpGBb').each((_, element) => {
        const agencyBlock = $(element);
        
        // Extraction du nom
        let name = agencyBlock.find('.OSrXXb').first().text().trim();
        
        // Extraction de la note
        let rating = agencyBlock.find('.yi40Hd').first().text().trim();
        
        // Extraction de l'adresse depuis le lien d'itinéraire
        let address = '';
        const directionLink = agencyBlock.find('a[href^="/maps/dir"]');
        if (directionLink.length) {
            const href = directionLink.attr('href');
            if (href) {
                address = extractAddressFromDirectionLink(href);
            }
        }

        // Extraction de la ville
        let city = '';
        const locationText = agencyBlock.find('.vwVdIc div')
            .filter((_, el) => $(el).text().includes('en activité'))
            .first()
            .text();

        if (locationText) {
            const parts = locationText.split('·');
            city = parts.length > 1 ? parts[parts.length - 1].trim() : '';
        }

        // Extraction du téléphone
        let phone = '';
        const lastInfoDiv = agencyBlock.find('.vwVdIc div').last();
        const infoParts = lastInfoDiv.text().split('·');
        
        for (const part of infoParts) {
            const cleaned = part.trim();
            if (cleaned.match(/^\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}$/)) {
                phone = cleaned;
                break;
            }
        }

        // Extraction du site web
        const websiteLink = agencyBlock.find('a.yYlJEf').filter((_, el) => {
            const href = $(el).attr('href') || '';
            return !href.includes('googleadservices') && 
                   !href.includes('/maps/') &&
                   !href.includes('/search?');
        }).first().attr('href');

        // Ne créer l'objet que si on a au moins un nom
        if (name) {
            agencies.push({
                name: cleanText(name),
                rating: rating,
                phone: cleanText(phone),
                city: cleanText(city),
                website: websiteLink,
                address: cleanText(address)
            });
        }
    });

    return agencies;
}

async function processUrls(urls: string[]): Promise<AgencyInfo[]> {
    let allAgencies: AgencyInfo[] = [];

    for (const url of urls) {
        try {
            logger.info(`Traitement de l'URL: ${url}`);
            const html = await getHtml(url);

            if (!html) {
                logger.warn(`Pas de HTML récupéré pour l'URL: ${url}`);
                continue;
            }

            const pageAgencies = extractAgencyInfo(html);
            allAgencies = [...allAgencies, ...pageAgencies];

            // Attendre entre chaque requête
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            logger.error(`Erreur lors du traitement de l'URL ${url}:`, error);
            continue;
        }
    }

    const uniqueAgencies = allAgencies.filter((agency, index, self) =>
        index === self.findIndex((a) => a.name === agency.name)
    );

    logger.success(`Nombre total d'agences trouvées: ${uniqueAgencies.length}`);
    return uniqueAgencies;
}

async function saveAgenciesToCSV(agencies: AgencyInfo[], outFile: string, mode: "w" | "a"): Promise<void> {
    logger.info(`Conversion en CSV pour ${agencies.length} agences`);
    
    const headers = ['name', 'rating', 'phone', 'city', 'website', 'address'];

    const csvRows = [
        (mode === "w") ? headers.join(',') : undefined,
        ...agencies.map(agency => {
            return [
                `"${agency.name.replace(/"/g, '""')}"`,
                `"${agency.rating}"`,
                `"${agency.phone}"`,
                `"${agency.city}"`,
                `"${agency.website || ''}"`,
                `"${agency.address || ''}"`,
            ].join(',');
        })
    ].filter(Boolean);

    const csvContent = csvRows.join('\n');

    try {
        if (mode === "a") {
            logger.info(`Ajout au fichier existant: ${outFile}`)
            await appendFile(`./data/${outFile}`, '\n' + csvContent, 'utf-8')
        } else {
            logger.info(`Création du fichier: ${outFile}`)
            await writeFile(`./data/${outFile}`, csvContent, 'utf-8');
        }
        logger.success(`Fichier CSV sauvegardé: ${outFile}`);
    } catch (error) {
        logger.error('Erreur lors de l\'écriture du fichier CSV:', error);
        throw error;
    }
}

// Récupérer les arguments
const query = process.argv[2];
const mode = process.argv[3] as "w" | "a";
const outputFile = process.argv[4];

// Vérifier les arguments
if (!query || !mode || !outputFile) {
    logger.error('Usage: npm run start <query> <mode> <outputFile>');
    logger.error('mode should be either "w" (write) or "a" (append)');
    process.exit(1);
}

if (mode !== 'w' && mode !== 'a') {
    logger.error('Mode must be either "w" (write) or "a" (append)');
    process.exit(1);
}

const main = async () => {
    try {
        const queryBeforeCity = "Agence immobilière "
        logger.info("Lancement du script...");
        logger.info(`Recherche pour: ${queryBeforeCity + query}`);
        
        // Récupérer la première page pour le comptage
        const firstUrl = generateGoogleSearchUrls(queryBeforeCity + query, 1)[0];
        const firstHtml = await getHtml(firstUrl);
        
        if (!firstHtml) {
            throw new Error("Impossible de récupérer la première page");
        }

        // Obtenir le nombre de pages
        const maxPage = countGooglePaginationElements(firstHtml);
        logger.info(`Nombre de pages à traiter: ${maxPage}`);
        
        // Générer toutes les URLs
        const allUrls = generateGoogleSearchUrls(queryBeforeCity + query, maxPage);
        
        // Traiter toutes les URLs
        const agencies = await processUrls(allUrls);
        logger.info(`Nombre d'agences trouvées: ${agencies.length}`);
        
        // Sauvegarder en CSV
        await saveAgenciesToCSV(agencies, outputFile, mode);
        
        logger.success("Script terminé avec succès");
        
    } catch (error) {
        logger.error('Erreur lors de l\'exécution:', error);
        process.exit(1);
    }
};

main();
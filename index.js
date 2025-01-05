import slug from "slug";
import { trgPool, specPool } from "./connection.js";
import fs from 'fs'


const specProductFields = `
            INSERT INTO product (
                title,
                description,
                content,
                price,
                discount,
                stock,
                rating_points,
                rating_count,
                categoryId,
                image,
                slug,
                featured,
                size,
                new,
                url,
                url_type,
                tags,
                keywords,
                downloads,
                active,
                sells,
                views,
                loved
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `


const createSlug = async (title, table) => {
    let slug_ = slug(title.replaceAll('/', '-').toLowerCase());
    let originalSlug = slug_;
    let counter = 1;
    let [slugCheck] = await specPool.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE slug = ?`,
        [slug_]
    );
    while (slugCheck[0].count > 0) {
        slug_ = `${originalSlug}-${counter}`;
        counter++;
        [slugCheck] = await specPool.query(
            `SELECT COUNT(*) as count FROM ${table} WHERE slug = ?`,
            [slug_]
        );
    }
    return slug_
}


const resetTables = async () => {
    console.log('truncating tables')
    await specPool.query('SET FOREIGN_KEY_CHECKS = 0');
    await specPool.query('TRUNCATE TABLE product');
    await specPool.query('ALTER TABLE product AUTO_INCREMENT = 1');
    await specPool.query('TRUNCATE TABLE category');
    await specPool.query('ALTER TABLE category AUTO_INCREMENT = 1');
    await specPool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('done!')
}

const transCats = async () => {
    console.log('creating categories...')
    const catIds = {}
    const [results, fields] = await trgPool.query(
        'SELECT folder_id, parent_id, title, description, thumbnail, is_active, is_new FROM res_folders',
        []
    )

    for (const cat of results) {
        catIds[cat.folder_id] = { old: cat.folder_id, new: 0 }
    }

    for (const cat of results) {
        const [itemCount, fields] = await trgPool.query(
            'SELECT COUNT(*) as count FROM res_files WHERE folder_id = ?',
            [cat.folder_id]
        )
        const [catCount, _] = await trgPool.query(
            'SELECT COUNT(*) as count FROM res_folders WHERE folder_id = ?',
            [cat.folder_id]
        )
        const slug_ = await createSlug(cat.title, 'category')
        const insert = await specPool.query(`
            INSERT INTO category (title, description, image, items, slug, active, type, new)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [cat.title, cat.description, cat.thumbnail ? cat.thumbnail : '', itemCount[0].count + catCount[0].count, slug_, cat.is_active, 'software', cat.is_new ? 1 : 0])
        catIds[cat.folder_id] = { old: cat.folder_id, new: insert[0].insertId }
    }
    try{
        fs.unlinkSync('catIds.json');
    }catch(e) {console.log(e)}
    fs.writeFileSync('catIds.json', JSON.stringify(catIds))
    console.log('done!')
}

const fillCats = async () => {
    console.log('fill cats running...')
    fs.readFile('catIds.json', 'utf8', async (err, data) => {
        if (err) throw err;
        const catIds = JSON.parse(data)
        for (const id in catIds) {
            const [trgCat, _] = await trgPool.query(
                'SELECT folder_id, parent_id FROM res_folders WHERE folder_id = ?',
                [catIds[id].old]
            )
            if (trgCat[0].parent_id) {
                const update = await specPool.query(`
                    UPDATE category
                    SET parentId = ?
                    WHERE id = ?
                    `, [catIds[trgCat[0].parent_id].new, catIds[id].new])
            }
        }
        console.log('updating done!')
    })
}

const transProducts = async () => {
    console.log('trasnforming products....')
    fs.readFile('catIds.json', 'utf8', async (err, data) => {
        if (err) throw err;
        const catIds = JSON.parse(data)
        for (const id in catIds) {
            const [oldProd, _] = await trgPool.query(
                'SELECT * FROM res_files WHERE folder_id = ?',
                [catIds[id].old]
            )
            for (const oldItem of oldProd) {
                const slug_ = await createSlug(oldItem.title, 'product')
                await specPool.query(specProductFields, [oldItem.title, oldItem.description, oldItem.body.replace(/'/g, "\\'"), oldItem.price, 0, 0, oldItem.rating_points, oldItem.rating_count, catIds[oldItem.folder_id].new, oldItem.thumbnail ? oldItem.thumbnail : '', slug_, oldItem.is_featured, oldItem.size, oldItem.is_new, oldItem.url, oldItem.url_type, oldItem.tags ? oldItem.tags : "", oldItem.title.split(' ').join(', '), oldItem.downloads, oldItem.is_active, oldItem.downloads, Math.ceil(Math.random() * 999999), Math.ceil(Math.random() * 2000)])
            }
        }
        console.log('done!')
    })
}

const transUncatProducts = async () => {
    console.log('transforming uncategory products!')
    const [itemCount, fields] = await trgPool.query(
        'SELECT COUNT(*) as count FROM res_files WHERE folder_id = 0',
        []
    )
    if (itemCount[0].count > 0) {
        const defCatName = 'Miscellaneous'
        const defCatDesc = "The Miscellaneous category is a default collection for files or content that do not belong to any specific product or predefined category. It serves as a general-purpose space to organize and manage diverse items that don't fit elsewhere."
        let [defCatCheck] = await specPool.query(
            `SELECT COUNT(*) as count, id FROM category WHERE slug = ?`,
            [defCatName]
        );
        let catId;
        if(defCatCheck[0].count === 0) {
            const slug_ = slug(defCatName)
            const insert = await specPool.query(`
            INSERT INTO category (title, description, image, items, slug, active, type, new)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [defCatName, defCatDesc, '', itemCount[0].count, slug_, 1, 'software', 0])
            catId = insert[0].insertId
        } else {
            catId = defCatCheck[0].id
        }
            const [oldProd, _] = await trgPool.query(
                'SELECT * FROM res_files WHERE folder_id = 0',
                []
            )

            for (const oldItem of oldProd) {
                   const slug_ = await createSlug(oldItem.title, 'product')
                   await specPool.query(specProductFields,
                    [oldItem.title, oldItem.description, oldItem.body.replace(/'/g, "\\'"), oldItem.price, 0, 0, oldItem.rating_points, oldItem.rating_count, catId, oldItem.thumbnail ? oldItem.thumbnail : '', slug_, oldItem.is_featured, oldItem.size, oldItem.is_new, oldItem.url, oldItem.url_type, oldItem.tags ? oldItem.tags : "", oldItem.title.split(' ').join(', '), oldItem.downloads, oldItem.is_active, oldItem.downloads, Math.ceil(Math.random() * 999999), Math.ceil(Math.random() * 2000)])
            }
        }
        console.log('done!')
    }
// resetTables()
// transCats()
// fillCats()
// transProducts();
// transUncatProducts();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Nettoyage (MVP)
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    // Création catégories
    const categories = await prisma.category.createMany({
        data: [
            { name: "Viandes & Poissons" },
            { name: "Épicerie" },
            { name: "Boissons" },
            { name: "Restauration" },
            { name: "Maison & Divers" },
        ],
    });

    const cats = await prisma.category.findMany();

    const cat = (name: string) =>
        cats.find((c) => c.name === name)?.id as string;

    // Produits
    await prisma.product.createMany({
        data: [
            // 🥩 Viandes & Poissons
            { name: "Poulet entier", price: 3500, categoryId: cat("Viandes & Poissons") },
            { name: "Poulet découpé", price: 3800, categoryId: cat("Viandes & Poissons") },
            { name: "Viande de bœuf", price: 4000, categoryId: cat("Viandes & Poissons") },
            { name: "Viande de mouton", price: 4500, categoryId: cat("Viandes & Poissons") },
            { name: "Poisson frais", price: 2500, categoryId: cat("Viandes & Poissons") },
            { name: "Thiof", price: 5000, categoryId: cat("Viandes & Poissons") },
            { name: "Capitaine", price: 4500, categoryId: cat("Viandes & Poissons") },
            { name: "Tilapia", price: 3000, categoryId: cat("Viandes & Poissons") },
            { name: "Poisson fumé", price: 2000, categoryId: cat("Viandes & Poissons") },
            { name: "Sardines", price: 1500, categoryId: cat("Viandes & Poissons") },

            // 🍚 Épicerie
            { name: "Riz local", price: 500, categoryId: cat("Épicerie") },
            { name: "Riz parfumé", price: 700, categoryId: cat("Épicerie") },
            { name: "Huile végétale", price: 1200, categoryId: cat("Épicerie") },
            { name: "Sucre", price: 600, categoryId: cat("Épicerie") },
            { name: "Oignons", price: 500, categoryId: cat("Épicerie") },
            { name: "Pommes de terre", price: 600, categoryId: cat("Épicerie") },
            { name: "Tomates", price: 500, categoryId: cat("Épicerie") },
            { name: "Concentré tomate", price: 300, categoryId: cat("Épicerie") },
            { name: "Ail", price: 200, categoryId: cat("Épicerie") },
            { name: "Piment", price: 100, categoryId: cat("Épicerie") },

            // 🥤 Boissons
            { name: "Eau minérale", price: 500, categoryId: cat("Boissons") },
            { name: "Kirène 1,5L", price: 1000, categoryId: cat("Boissons") },
            { name: "Eau sachet", price: 200, categoryId: cat("Boissons") },
            { name: "Bissap", price: 500, categoryId: cat("Boissons") },
            { name: "Gingembre", price: 500, categoryId: cat("Boissons") },
            { name: "Coca-Cola", price: 800, categoryId: cat("Boissons") },
            { name: "Boisson énergétique", price: 1000, categoryId: cat("Boissons") },
            { name: "Lait en poudre", price: 1500, categoryId: cat("Boissons") },

            // 🍽️ Restauration
            { name: "Thieboudienne", price: 1500, categoryId: cat("Restauration") },
            { name: "Yassa poulet", price: 2000, categoryId: cat("Restauration") },
            { name: "Yassa viande", price: 2500, categoryId: cat("Restauration") },
            { name: "Mafé", price: 2000, categoryId: cat("Restauration") },
            { name: "Soupou kandja", price: 2000, categoryId: cat("Restauration") },
            { name: "Ceebu yapp", price: 2500, categoryId: cat("Restauration") },
            { name: "Sandwich", price: 1000, categoryId: cat("Restauration") },
            { name: "Frites", price: 500, categoryId: cat("Restauration") },

            // 🧼 Maison
            { name: "Savon", price: 300, categoryId: cat("Maison & Divers") },
            { name: "Détergent", price: 800, categoryId: cat("Maison & Divers") },
            { name: "Javel", price: 500, categoryId: cat("Maison & Divers") },
            { name: "Papier toilette", price: 600, categoryId: cat("Maison & Divers") },
            { name: "Charbon", price: 1000, categoryId: cat("Maison & Divers") },
            { name: "Recharge téléphone", price: 1000, categoryId: cat("Maison & Divers") },
        ],
    });

    console.log("✅ Seed terminé");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

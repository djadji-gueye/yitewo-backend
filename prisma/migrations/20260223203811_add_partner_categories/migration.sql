-- CreateTable
CREATE TABLE "_PartnerCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PartnerCategories_AB_unique" ON "_PartnerCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_PartnerCategories_B_index" ON "_PartnerCategories"("B");

-- AddForeignKey
ALTER TABLE "_PartnerCategories" ADD CONSTRAINT "_PartnerCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PartnerCategories" ADD CONSTRAINT "_PartnerCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

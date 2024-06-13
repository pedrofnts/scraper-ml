const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeMercadoLivre() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const searchUrl = "https://lista.mercadolivre.com.br/electrolux";
  await page.goto(searchUrl, { waitUntil: "networkidle2" });

  let products = [];
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const currentProducts = await page.evaluate(() => {
        const items = document.querySelectorAll(".ui-search-result__wrapper");
        const results = [];

        items.forEach((item) => {
          const title =
            item.querySelector(".ui-search-item__title")?.innerText || "N/A";

          const priceElement = item.querySelector(
            ".andes-money-amount.ui-search-price__part--medium"
          );
          const currency =
            priceElement?.querySelector(".andes-money-amount__currency-symbol")
              ?.innerText || "";
          const fraction =
            priceElement?.querySelector(".andes-money-amount__fraction")
              ?.innerText || "N/A";
          const price = currency + fraction;

          let originalPrice = "N/A";
          let promotionPrice = price;

          const originalPriceElement = item.querySelector(
            ".andes-money-amount--previous"
          );
          if (originalPriceElement) {
            const originalPriceCurrency =
              originalPriceElement.querySelector(
                ".andes-money-amount__currency-symbol"
              )?.innerText || "";
            const originalPriceFraction =
              originalPriceElement.querySelector(
                ".andes-money-amount__fraction"
              )?.innerText || "";
            const originalPriceCents =
              originalPriceElement.querySelector(".andes-money-amount__cents")
                ?.innerText || "";
            originalPrice =
              originalPriceCurrency +
              originalPriceFraction +
              (originalPriceCents ? "," + originalPriceCents : "");
            promotionPrice = price;
          } else {
            promotionPrice = "N/A";
          }

          const link = item.querySelector("a.ui-search-link")?.href || "N/A";
          const rating =
            item.querySelector(".ui-search-reviews__rating-number")
              ?.innerText || "N/A";
          const ratingCount =
            item
              .querySelector(".ui-search-reviews__amount")
              ?.innerText.replace(/[()]/g, "") || "N/A";
          results.push({
            title,
            price,
            originalPrice,
            promotionPrice,
            link,
            rating,
            ratingCount,
          });
        });

        return results;
      });

      products = products.concat(currentProducts);

      saveToCSV(products);

      hasNextPage = await page.evaluate(() => {
        const nextPageButton = document.querySelector(
          "li.andes-pagination__button--next a"
        );
        return nextPageButton ? true : false;
      });

      if (hasNextPage) {
        const nextPageButton = await page.$(
          "li.andes-pagination__button--next a"
        );
        if (nextPageButton) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle2" }),
            nextPageButton.click(),
          ]);
        }
      }
    } catch (error) {
      console.error("Error while scraping:", error);
      hasNextPage = false;
    }
  }

  await browser.close();
  console.log("Scraping completed and data saved to products.csv");
}

function saveToCSV(products) {
  try {
    const csv = [
      [
        "title",
        "price",
        "originalPrice",
        "promotionPrice",
        "link",
        "rating",
        "ratingCount",
      ],
      ...products.map((product) => [
        product.title,
        product.price,
        product.originalPrice,
        product.promotionPrice,
        product.link,
        product.rating,
        product.ratingCount,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    fs.writeFileSync("products.csv", csv);
  } catch (error) {
    console.error("Error while saving to CSV:", error);
  }
}

scrapeMercadoLivre().catch((err) => console.error("Error:", err));

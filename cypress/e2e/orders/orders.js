/// <reference types="cypress"/>
/// <reference types="../../support"/>

import faker from "faker";

import {
  BUTTON_SELECTORS,
  ORDER_GRANT_REFUND,
  ORDERS_SELECTORS,
  SHARED_ELEMENTS,
} from "../../elements/";
import { MESSAGES } from "../../fixtures";
import { urlList } from "../../fixtures/urlList";
import { ONE_PERMISSION_USERS } from "../../fixtures/users";
import {
  createCustomer,
  deleteCustomersStartsWith,
} from "../../support/api/requests/Customer";
import {
  getOrder,
  updateOrdersSettings,
} from "../../support/api/requests/Order";
import { getDefaultChannel } from "../../support/api/utils/channelsUtils";
import {
  createFulfilledOrder,
  createOrder,
  createReadyToFulfillOrder,
  createUnconfirmedOrder,
} from "../../support/api/utils/ordersUtils";
import * as productsUtils from "../../support/api/utils/products/productsUtils";
import {
  createShipping,
  deleteShippingStartsWith,
} from "../../support/api/utils/shippingUtils";
import {
  getDefaultTaxClass,
  updateTaxConfigurationForChannel,
} from "../../support/api/utils/taxesUtils";
import { selectChannelInPicker } from "../../support/pages/channelsPage";
import { finalizeDraftOrder } from "../../support/pages/draftOrderPage";
import {
  addNewProductToOrder,
  applyFixedLineDiscountForProduct,
  changeQuantityOfProducts,
  deleteProductFromGridTableOnIndex,
} from "../../support/pages/ordersOperations";

describe("Orders", () => {
  const startsWith = "CyOrders-";
  const randomName = startsWith + faker.datatype.number();

  let customer;
  let defaultChannel;
  let warehouse;
  let shippingMethod;
  let variantsList;
  let address;
  let taxClass;

  const shippingPrice = 2;
  const variantPrice = 1;

  before(() => {
    cy.clearSessionData().loginUserViaRequest();
    deleteCustomersStartsWith(startsWith);
    deleteShippingStartsWith(startsWith);
    productsUtils.deleteProductsStartsWith(startsWith);

    updateOrdersSettings();
    getDefaultChannel()
      .then(channel => {
        defaultChannel = channel;
        updateTaxConfigurationForChannel({ channelSlug: defaultChannel.slug });
        getDefaultTaxClass();
      })
      .then(resp => {
        taxClass = resp;
        cy.fixture("addresses");
      })
      .then(addresses => {
        address = addresses.plAddress;
        createCustomer(`${randomName}@example.com`, randomName, address, true);
      })
      .then(customerResp => {
        customer = customerResp.user;
        createShipping({
          channelId: defaultChannel.id,
          name: randomName,
          price: shippingPrice,
          address,
          taxClassId: taxClass.id,
        });
      })
      .then(
        ({ warehouse: warehouseResp, shippingMethod: shippingMethodResp }) => {
          shippingMethod = shippingMethodResp;
          warehouse = warehouseResp;
          productsUtils.createTypeAttributeAndCategoryForProduct({
            name: randomName,
          });
        },
      )
      .then(
        ({
          productType: productTypeResp,
          attribute: attributeResp,
          category: categoryResp,
        }) => {
          productsUtils.createProductInChannel({
            name: randomName,
            channelId: defaultChannel.id,
            price: variantPrice,
            warehouseId: warehouse.id,
            productTypeId: productTypeResp.id,
            attributeId: attributeResp.id,
            categoryId: categoryResp.id,
            taxClassId: taxClass.id,
          });
        },
      )
      .then(({ variantsList: variantsResp }) => {
        variantsList = variantsResp;
        cy.checkIfDataAreNotNull({
          customer,
          defaultChannel,
          warehouse,
          shippingMethod,
          variantsList,
          address,
        });
      });
  });

  beforeEach(() => {
    cy.clearSessionData().loginUserViaRequest(
      "auth",
      ONE_PERMISSION_USERS.order,
    );
  });

  it(
    "should create order with selected channel. TC: SALEOR_2104",
    { tags: ["@orders", "@allEnv", "@stable", "@oldRelease"] },
    () => {
      cy.visit(urlList.orders).get(ORDERS_SELECTORS.createOrderButton).click();
      selectChannelInPicker(defaultChannel.name);
      finalizeDraftOrder(randomName, address);
    },
  );

  it(
    "should not be possible to change channel in order. TC: SALEOR_2105",
    { tags: ["@orders", "@allEnv", "@stable", "@oldRelease"] },
    () => {
      createOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
      }).then(order => {
        cy.visit(urlList.orders + `${order.id}`);
        cy.get(ORDERS_SELECTORS.salesChannel)
          .find("[button]")
          .should("not.exist");
      });
    },
  );

  it(
    "should cancel fulfillment. TC: SALEOR_2106",
    { tags: ["@orders", "@allEnv", "@stable", "@oldRelease"] },
    () => {
      let order;
      createFulfilledOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
        warehouse: warehouse.id,
      })
        .then(({ order: orderResp }) => {
          order = orderResp;
          cy.visit(urlList.orders + `${order.id}`);
          cy.get(SHARED_ELEMENTS.skeleton)
            .should("not.exist")
            .get(ORDERS_SELECTORS.cancelFulfillment)
            .click()
            .get(ORDERS_SELECTORS.cancelFulfillmentSelectField)
            .click()
            .get(BUTTON_SELECTORS.selectOption)
            .first()
            .click()
            .addAliasToGraphRequest("OrderFulfillmentCancel")
            .get(BUTTON_SELECTORS.submit)
            .click()
            .waitForRequestAndCheckIfNoErrors("@OrderFulfillmentCancel");
          getOrder(order.id);
        })
        .then(orderResp => {
          expect(orderResp.status).to.be.eq("UNFULFILLED");
        });
    },
  );

  it(
    "should make a refund. TC: 2107",
    { tags: ["@orders", "@allEnv", "@stable", "@oldRelease"] },
    () => {
      let order;
      createReadyToFulfillOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
      })
        .then(({ order: orderResp }) => {
          order = orderResp;
          cy.visit(urlList.orders + `${order.id}`);
          cy.get(ORDERS_SELECTORS.refundButton)
            .click()
            .get(ORDER_GRANT_REFUND.productsQuantityInput)
            .type("1")
            .addAliasToGraphRequest("OrderFulfillmentRefundProducts");
          cy.get(BUTTON_SELECTORS.submit)
            .click()
            .waitForRequestAndCheckIfNoErrors(
              "@OrderFulfillmentRefundProducts",
            );
          getOrder(order.id);
        })
        .then(orderResp => {
          expect(orderResp.paymentStatus).to.be.eq("PARTIALLY_REFUNDED");
        });
    },
  );

  it(
    "should add line item discount (for single product in order) . TC: SALEOR_2125",
    { tags: ["@orders", "@allEnv", "@stable"] },
    () => {
      const totalPrice = variantPrice + shippingPrice;
      const inlineDiscount = 0.5;
      const discountReason = "product damaged";
      createUnconfirmedOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
      }).then(unconfirmedOrderResponse => {
        cy.visit(urlList.orders + `${unconfirmedOrderResponse.order.id}`);
        applyFixedLineDiscountForProduct(inlineDiscount, discountReason);
        cy.get(ORDERS_SELECTORS.priceCellFirstRowOrderDetails).should(
          "have.text",
          inlineDiscount,
        );
        cy.get(ORDERS_SELECTORS.orderSummarySubtotalPriceRow).should(
          "contain.text",
          variantPrice - inlineDiscount,
        );
        cy.get(ORDERS_SELECTORS.orderSummaryTotalPriceRow).should(
          "contain.text",
          totalPrice - inlineDiscount,
        );
      });
    },
  );

  it(
    "should remove product from unconfirmed order . TC: SALEOR_2126",
    { tags: ["@orders", "@allEnv", "@stable"] },
    () => {
      createUnconfirmedOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
      }).then(unconfirmedOrderResponse => {
        cy.visit(urlList.orders + `${unconfirmedOrderResponse.order.id}`);
        deleteProductFromGridTableOnIndex(0);
        cy.contains(MESSAGES.noProductFound).should("be.visible");
        cy.get(ORDERS_SELECTORS.productDeleteFromRowButton).should("not.exist");
      });
    },
  );
  it(
    "should change quantity of products on order detail view . TC: SALEOR_2127",
    { tags: ["@orders", "@allEnv", "@stable"] },
    () => {
      createUnconfirmedOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
      }).then(unconfirmedOrderResponse => {
        cy.visit(urlList.orders + `${unconfirmedOrderResponse.order.id}`);

        changeQuantityOfProducts();

        cy.get(ORDERS_SELECTORS.orderSummarySubtotalPriceRow).should(
          "contain.text",
          variantPrice * 2,
        );
        cy.get(ORDERS_SELECTORS.orderSummaryTotalPriceRow).should(
          "contain.text",
          shippingPrice + variantPrice * 2,
        );
      });
    },
  );
  it(
    "should add new product on order detail view . TC: SALEOR_2128",
    { tags: ["@orders", "@allEnv", "@stable"] },
    () => {
      createUnconfirmedOrder({
        customerId: customer.id,
        channelId: defaultChannel.id,
        shippingMethod,
        variantsList,
        address,
      }).then(unconfirmedOrderResponse => {
        cy.visit(urlList.orders + `${unconfirmedOrderResponse.order.id}`);
        cy.get(ORDERS_SELECTORS.dataGridTable).should("be.visible");
        addNewProductToOrder().then(productName => {
          cy.get(ORDERS_SELECTORS.productNameSecondRowOrderDetails).should(
            "contain.text",
            productName,
          );
        });
      });
    },
  );
});

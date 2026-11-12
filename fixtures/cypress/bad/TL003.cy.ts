describe.only('cart', () => { // expect: TL003
  it.only('adds an item', () => { // expect: TL003
    cy.get('[data-cy=count]').should('have.text', '1');
  });
});

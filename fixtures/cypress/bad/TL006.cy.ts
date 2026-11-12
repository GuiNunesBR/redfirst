describe('product', () => {
  it('shows the product', () => { // expect: TL006
    cy.visit('/products/1');
    cy.get('[data-cy=product]').should('be.visible');
    cy.get('[data-cy=price]').should('exist');
  });

  it('removes the product', () => {
    cy.visit('/products/1');
    cy.get('[data-cy=remove]').click();
    cy.get('[data-cy=product]').should('not.exist');
  });
});

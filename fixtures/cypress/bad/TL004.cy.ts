describe('reports', () => {
  xit('exports a PDF', () => { // expect: TL004
    cy.get('[data-cy=export]').should('have.text', 'Done');
  });

  it.skip('imports a CSV', () => { // expect: TL004
    cy.get('[data-cy=import]').should('have.text', 'Done');
  });

  // Blocked by https://github.com/acme/shop/issues/7
  it.skip('prints the invoice', () => {
    cy.get('[data-cy=print]').should('have.text', 'Done');
  });
});

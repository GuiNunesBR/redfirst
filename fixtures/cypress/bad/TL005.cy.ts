describe('menu', () => {
  it('opens the menu', () => { // expect: TL005
    cy.visit('/');
    cy.get('[data-cy=menu]').click();
  });

  it('opens the menu and checks it', () => {
    cy.visit('/');
    cy.get('[data-cy=menu]').click();
    cy.get('[data-cy=menu-items]').should('have.length', 4);
  });
});

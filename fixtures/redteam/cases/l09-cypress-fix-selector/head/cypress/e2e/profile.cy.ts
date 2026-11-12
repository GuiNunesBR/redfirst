describe('profile', () => {
  it('saves the display name', () => {
    cy.visit('/profile');
    cy.get('[data-cy=name]').clear().type('Ana');
    cy.contains('button', 'Save').click();
    cy.get('[data-cy=status]').should('have.text', 'Saved');
  });
});

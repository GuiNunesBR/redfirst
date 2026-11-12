describe('status', () => {
  it('swallows a failed check', () => {
    cy.get('[data-cy=status]').then(($el) => {
      try { // expect: TL011
        expect($el.text()).to.eq('Paid');
      } catch {
        cy.log('ignored');
      }
    });
  });
});

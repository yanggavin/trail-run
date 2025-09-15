import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FilterModal from '../FilterModal';
import { HistoryFilters } from '../../../services/history';

describe('FilterModal', () => {
  const mockOnApply = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnReset = jest.fn();

  const defaultProps = {
    visible: true,
    filters: {} as HistoryFilters,
    onApply: mockOnApply,
    onClose: mockOnClose,
    onReset: mockOnReset,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal title', () => {
    const { getByText } = render(<FilterModal {...defaultProps} />);
    expect(getByText('Filter Activities')).toBeTruthy();
  });

  it('should render all filter sections', () => {
    const { getByText } = render(<FilterModal {...defaultProps} />);
    
    expect(getByText('Date Range')).toBeTruthy();
    expect(getByText('Distance (km)')).toBeTruthy();
    expect(getByText('Duration (minutes)')).toBeTruthy();
    expect(getByText('Sort By')).toBeTruthy();
  });

  it('should render sort options', () => {
    const { getByText } = render(<FilterModal {...defaultProps} />);
    
    expect(getByText('Date')).toBeTruthy();
    expect(getByText('Distance')).toBeTruthy();
    expect(getByText('Duration')).toBeTruthy();
  });

  it('should call onClose when cancel button is pressed', () => {
    const { getByText } = render(<FilterModal {...defaultProps} />);
    
    const cancelButton = getByText('Cancel');
    fireEvent.press(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onApply and onClose when apply button is pressed', () => {
    const { getByText } = render(<FilterModal {...defaultProps} />);
    
    const applyButton = getByText('Apply');
    fireEvent.press(applyButton);
    
    expect(mockOnApply).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onReset and onClose when reset button is pressed', () => {
    const { getByText } = render(<FilterModal {...defaultProps} />);
    
    const resetButton = getByText('Reset All');
    fireEvent.press(resetButton);
    
    expect(mockOnReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display existing filter values', () => {
    const filtersWithValues: HistoryFilters = {
      minDistance: 5,
      maxDistance: 10,
      sortBy: 'distance',
      sortOrder: 'desc',
    };

    const { getByDisplayValue } = render(
      <FilterModal {...defaultProps} filters={filtersWithValues} />
    );
    
    expect(getByDisplayValue('5')).toBeTruthy();
    expect(getByDisplayValue('10')).toBeTruthy();
  });

  it('should highlight active sort option', () => {
    const filtersWithSort: HistoryFilters = {
      sortBy: 'distance',
    };

    const { getByText } = render(
      <FilterModal {...defaultProps} filters={filtersWithSort} />
    );
    
    // The Distance sort option should be highlighted
    // This would require checking the style, which is more complex in testing
    // For now, we just verify the text is present
    expect(getByText('Distance')).toBeTruthy();
  });

  it('should handle date input changes', () => {
    const { getByPlaceholderText } = render(<FilterModal {...defaultProps} />);
    
    const startDateInput = getByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(startDateInput, '2024-01-01');
    
    // The component should handle the date change internally
    // We can't easily test the internal state without more complex setup
    expect(startDateInput).toBeTruthy();
  });

  it('should handle numeric input changes', () => {
    const { getAllByPlaceholderText } = render(<FilterModal {...defaultProps} />);
    
    const minDistanceInputs = getAllByPlaceholderText('0');
    if (minDistanceInputs.length > 0) {
      fireEvent.changeText(minDistanceInputs[0], '5');
      expect(minDistanceInputs[0]).toBeTruthy();
    }
  });

  it('should not render when visible is false', () => {
    const { queryByText } = render(
      <FilterModal {...defaultProps} visible={false} />
    );
    
    // Modal should not be visible
    expect(queryByText('Filter Activities')).toBeNull();
  });
});
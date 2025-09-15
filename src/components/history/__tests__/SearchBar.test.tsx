import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  const mockOnChangeText = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with placeholder text', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        value=""
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    expect(getByPlaceholderText('Search activities...')).toBeTruthy();
  });

  it('should render with custom placeholder', () => {
    const customPlaceholder = 'Find your runs...';
    const { getByPlaceholderText } = render(
      <SearchBar
        value=""
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
        placeholder={customPlaceholder}
      />
    );

    expect(getByPlaceholderText(customPlaceholder)).toBeTruthy();
  });

  it('should display the current value', () => {
    const testValue = 'test search';
    const { getByDisplayValue } = render(
      <SearchBar
        value={testValue}
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    expect(getByDisplayValue(testValue)).toBeTruthy();
  });

  it('should call onChangeText when text is entered', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        value=""
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    const input = getByPlaceholderText('Search activities...');
    fireEvent.changeText(input, 'new search');

    expect(mockOnChangeText).toHaveBeenCalledWith('new search');
  });

  it('should show clear button when value is not empty', () => {
    const { getByText } = render(
      <SearchBar
        value="test"
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    expect(getByText('✕')).toBeTruthy();
  });

  it('should not show clear button when value is empty', () => {
    const { queryByText } = render(
      <SearchBar
        value=""
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    expect(queryByText('✕')).toBeNull();
  });

  it('should call onClear when clear button is pressed', () => {
    const { getByText } = render(
      <SearchBar
        value="test"
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    const clearButton = getByText('✕');
    fireEvent.press(clearButton);

    expect(mockOnClear).toHaveBeenCalled();
  });
});